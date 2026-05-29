use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use jwalk::WalkDir;
use rayon::prelude::*;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

const TRASH_DIR: &str = ".structura-trash";
const READ_BUF: usize = 64 * 1024;
/// Cheap first-pass hash window. Files identical in size whose first 16 KB also
/// match are the only ones worth fully hashing — this skips reading whole large
/// media files that merely happen to share a size.
const PARTIAL_BYTES: u64 = 16 * 1024;
/// Emit a progress event at most every N hashed files to avoid flooding the IPC.
const PROGRESS_STEP: u64 = 64;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub paths: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DedupProgress {
    /// "scanning" (walking disk) | "hashing" (partial pass) | "verifying" (full
    /// pass) | "done". `total` is 0 while indeterminate (scanning).
    phase: &'static str,
    processed: u64,
    total: u64,
}

fn emit(app: Option<&AppHandle>, phase: &'static str, processed: u64, total: u64) {
    if let Some(app) = app {
        let _ = app.emit(
            "dedup-progress",
            DedupProgress {
                phase,
                processed,
                total,
            },
        );
    }
}

#[tauri::command]
pub async fn find_duplicates(
    app: AppHandle,
    root_fs_path: String,
    min_size_bytes: Option<u64>,
) -> AppResult<Vec<DuplicateGroup>> {
    let root = PathBuf::from(&root_fs_path);
    if !root.is_dir() {
        return Err(AppError::NotFound { path: root_fs_path });
    }
    let min = min_size_bytes.unwrap_or(1);
    // Heavy CPU + IO work: keep it off the async runtime so progress events keep
    // flowing and the UI stays responsive.
    tauri::async_runtime::spawn_blocking(move || find_sync(Some(&app), &root, min))
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

fn find_sync(
    app: Option<&AppHandle>,
    root: &Path,
    min_size: u64,
) -> AppResult<Vec<DuplicateGroup>> {
    // Phase 1 — walk the disk collecting (path, size).
    let files = collect_files(app, root, min_size)?;

    // Bucket by exact size; a size seen only once can never have a duplicate.
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    for (path, size) in files {
        by_size.entry(size).or_default().push(path);
    }
    let partial_jobs: Vec<(u64, PathBuf)> = by_size
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .flat_map(|(size, paths)| paths.into_iter().map(move |p| (size, p)))
        .collect();

    // Phase 2 — partial hash (first PARTIAL_BYTES) of every size-collision file,
    // in parallel. Small files (<= window) get hashed in full here already.
    let total_partial = partial_jobs.len() as u64;
    emit(app, "hashing", 0, total_partial);
    let counter = AtomicU64::new(0);
    let partial: Vec<(u64, [u8; 32], PathBuf, bool)> = partial_jobs
        .par_iter()
        .filter_map(|(size, path)| {
            let complete = *size <= PARTIAL_BYTES;
            let limit = if complete { None } else { Some(PARTIAL_BYTES) };
            let digest = hash_file(path, limit).ok();
            let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
            if done % PROGRESS_STEP == 0 || done == total_partial {
                emit(app, "hashing", done, total_partial);
            }
            digest.map(|d| (*size, d, path.clone(), complete))
        })
        .collect();

    // Group by (size, partial digest). Singletons drop out.
    let mut by_partial: HashMap<(u64, [u8; 32]), Vec<(PathBuf, bool)>> = HashMap::new();
    for (size, digest, path, complete) in partial {
        by_partial
            .entry((size, digest))
            .or_default()
            .push((path, complete));
    }

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut full_jobs: Vec<(u64, PathBuf)> = Vec::new();
    for ((size, digest), members) in by_partial {
        if members.len() < 2 {
            continue;
        }
        // If the whole group was small enough to be hashed in full during the
        // partial pass, the partial digest IS the content digest — emit as-is.
        if members.iter().all(|(_, complete)| *complete) {
            groups.push(DuplicateGroup {
                hash: hex(&digest),
                size,
                paths: members
                    .into_iter()
                    .map(|(p, _)| p.to_string_lossy().into_owned())
                    .collect(),
            });
        } else {
            for (path, _) in members {
                full_jobs.push((size, path));
            }
        }
    }

    // Phase 3 — full hash only the files that survived the partial filter.
    let total_full = full_jobs.len() as u64;
    if total_full > 0 {
        emit(app, "verifying", 0, total_full);
        let counter = AtomicU64::new(0);
        let full: Vec<(u64, [u8; 32], PathBuf)> = full_jobs
            .par_iter()
            .filter_map(|(size, path)| {
                let digest = hash_file(path, None).ok();
                let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
                if done % PROGRESS_STEP == 0 || done == total_full {
                    emit(app, "verifying", done, total_full);
                }
                digest.map(|d| (*size, d, path.clone()))
            })
            .collect();

        let mut by_hash: HashMap<(u64, [u8; 32]), Vec<PathBuf>> = HashMap::new();
        for (size, digest, path) in full {
            by_hash.entry((size, digest)).or_default().push(path);
        }
        for ((size, digest), paths) in by_hash {
            if paths.len() < 2 {
                continue;
            }
            groups.push(DuplicateGroup {
                hash: hex(&digest),
                size,
                paths: paths
                    .into_iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect(),
            });
        }
    }

    groups.sort_by(|a, b| {
        let wasted_a = a.size.saturating_mul((a.paths.len() as u64).saturating_sub(1));
        let wasted_b = b.size.saturating_mul((b.paths.len() as u64).saturating_sub(1));
        wasted_b.cmp(&wasted_a)
    });

    emit(app, "done", 0, 0);
    Ok(groups)
}

fn collect_files(
    app: Option<&AppHandle>,
    root: &Path,
    min_size: u64,
) -> AppResult<Vec<(PathBuf, u64)>> {
    let walker = WalkDir::new(root)
        .follow_links(false)
        .skip_hidden(false)
        .process_read_dir(|_, _, _, children| {
            children.retain(|entry_result| {
                let Ok(entry) = entry_result else { return true };
                let name = entry.file_name().to_string_lossy();
                name != TRASH_DIR
            });
        });

    let mut out = Vec::new();
    let mut found: u64 = 0;
    for entry_result in walker {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let ft = entry.file_type();
        if !ft.is_file() || ft.is_symlink() {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        if size < min_size {
            continue;
        }
        out.push((entry.path(), size));
        found += 1;
        if found % 256 == 0 {
            emit(app, "scanning", found, 0);
        }
    }
    emit(app, "scanning", found, 0);
    Ok(out)
}

/// SHA-256 of the file, optionally limited to the first `limit` bytes.
fn hash_file(path: &Path, limit: Option<u64>) -> AppResult<[u8; 32]> {
    let file = File::open(path).map_err(|e| AppError::Io(e.to_string()))?;
    let mut reader = BufReader::with_capacity(READ_BUF, file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; READ_BUF];
    let mut remaining = limit.unwrap_or(u64::MAX);
    while remaining > 0 {
        let want = remaining.min(READ_BUF as u64) as usize;
        let n = reader
            .read(&mut buf[..want])
            .map_err(|e| AppError::Io(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        remaining -= n as u64;
    }
    Ok(hasher.finalize().into())
}

fn hex(bytes: &[u8]) -> String {
    const TABLE: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(TABLE[(b >> 4) as usize] as char);
        out.push(TABLE[(b & 0xf) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write(path: &Path, bytes: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn groups_identical_files_across_dirs() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a/file.bin"), b"hello world");
        write(&root.join("b/nested/copy.bin"), b"hello world");
        write(&root.join("c/unique.bin"), b"different content");

        let groups = find_sync(None, root, 1).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].paths.len(), 2);
        assert_eq!(groups[0].size, 11);
    }

    #[test]
    fn files_with_same_size_but_different_content_are_not_grouped() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.bin"), b"abcdefgh");
        write(&root.join("b.bin"), b"12345678");
        let groups = find_sync(None, root, 1).unwrap();
        assert!(groups.is_empty());
    }

    #[test]
    fn respects_min_size_filter() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.bin"), b"x");
        write(&root.join("b.bin"), b"x");
        let none = find_sync(None, root, 2).unwrap();
        assert!(none.is_empty());
        let one = find_sync(None, root, 1).unwrap();
        assert_eq!(one.len(), 1);
    }

    #[test]
    fn skips_structura_trash_dir() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join(".structura-trash/old.bin"), b"same");
        write(&root.join("active.bin"), b"same");
        let groups = find_sync(None, root, 1).unwrap();
        assert!(groups.is_empty());
    }

    #[test]
    fn sorts_by_wasted_space_desc() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("small1.bin"), b"ab");
        write(&root.join("small2.bin"), b"ab");
        let big = vec![0u8; 1024];
        write(&root.join("big1.bin"), &big);
        write(&root.join("big2.bin"), &big);
        let groups = find_sync(None, root, 1).unwrap();
        assert_eq!(groups.len(), 2);
        assert!(groups[0].size >= groups[1].size);
    }

    #[test]
    fn detects_large_duplicates_past_partial_window() {
        // Two files larger than PARTIAL_BYTES that are byte-identical must still
        // be grouped (exercises the full-hash verification pass).
        let dir = tempdir().unwrap();
        let root = dir.path();
        let big = vec![7u8; (PARTIAL_BYTES as usize) * 3 + 123];
        write(&root.join("x/a.bin"), &big);
        write(&root.join("y/b.bin"), &big);
        let groups = find_sync(None, root, 1).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].paths.len(), 2);
    }

    #[test]
    fn large_files_sharing_only_a_prefix_are_not_grouped() {
        // Identical first PARTIAL_BYTES, divergent tail — the full pass must
        // separate them.
        let dir = tempdir().unwrap();
        let root = dir.path();
        let mut a = vec![1u8; (PARTIAL_BYTES as usize) * 2];
        let mut b = a.clone();
        let n = a.len();
        a[n - 1] = 9;
        b[n - 1] = 8;
        write(&root.join("a.bin"), &a);
        write(&root.join("b.bin"), &b);
        let groups = find_sync(None, root, 1).unwrap();
        assert!(groups.is_empty());
    }
}
