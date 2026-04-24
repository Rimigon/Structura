use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use jwalk::WalkDir;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};

const TRASH_DIR: &str = ".structura-trash";
const READ_BUF: usize = 64 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub paths: Vec<String>,
}

#[tauri::command]
pub async fn find_duplicates(
    root_fs_path: String,
    min_size_bytes: Option<u64>,
) -> AppResult<Vec<DuplicateGroup>> {
    let root = PathBuf::from(&root_fs_path);
    if !root.is_dir() {
        return Err(AppError::NotFound { path: root_fs_path });
    }
    find_sync(&root, min_size_bytes.unwrap_or(1))
}

fn find_sync(root: &Path, min_size: u64) -> AppResult<Vec<DuplicateGroup>> {
    let files = collect_files(root, min_size)?;

    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    for (path, size) in files {
        by_size.entry(size).or_default().push(path);
    }

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    for (size, candidates) in by_size {
        if candidates.len() < 2 {
            continue;
        }
        let mut by_hash: HashMap<[u8; 32], Vec<PathBuf>> = HashMap::new();
        for path in candidates {
            match hash_file(&path) {
                Ok(digest) => by_hash.entry(digest).or_default().push(path),
                Err(_) => continue,
            }
        }
        for (digest, paths) in by_hash {
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

    Ok(groups)
}

fn collect_files(root: &Path, min_size: u64) -> AppResult<Vec<(PathBuf, u64)>> {
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
    }
    Ok(out)
}

fn hash_file(path: &Path) -> AppResult<[u8; 32]> {
    let file = File::open(path).map_err(|e| AppError::Io(e.to_string()))?;
    let mut reader = BufReader::with_capacity(READ_BUF, file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; READ_BUF];
    loop {
        let n = reader.read(&mut buf).map_err(|e| AppError::Io(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
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

        let groups = find_sync(root, 1).unwrap();
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
        let groups = find_sync(root, 1).unwrap();
        assert!(groups.is_empty());
    }

    #[test]
    fn respects_min_size_filter() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.bin"), b"x");
        write(&root.join("b.bin"), b"x");
        let none = find_sync(root, 2).unwrap();
        assert!(none.is_empty());
        let one = find_sync(root, 1).unwrap();
        assert_eq!(one.len(), 1);
    }

    #[test]
    fn skips_structura_trash_dir() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join(".structura-trash/old.bin"), b"same");
        write(&root.join("active.bin"), b"same");
        let groups = find_sync(root, 1).unwrap();
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
        let groups = find_sync(root, 1).unwrap();
        assert_eq!(groups.len(), 2);
        assert!(groups[0].size >= groups[1].size);
    }
}
