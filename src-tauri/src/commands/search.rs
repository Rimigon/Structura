use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

use jwalk::WalkDir;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

const TRASH_DIR: &str = ".structura-trash";
const DEFAULT_MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_RESULTS: usize = 5_000;
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchContentOptions {
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub max_file_size_bytes: Option<u64>,
    #[serde(default)]
    pub max_results: Option<usize>,
    #[serde(default)]
    pub include_hidden: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentMatch {
    pub path: String,
    pub line: u32,
    pub preview: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchContentResult {
    pub matches: Vec<ContentMatch>,
    pub scanned_files: u32,
    pub truncated: bool,
}

#[tauri::command]
pub async fn search_content(
    root_fs_path: String,
    query: String,
    opts: Option<SearchContentOptions>,
) -> AppResult<SearchContentResult> {
    let root = PathBuf::from(&root_fs_path);
    if !root.is_dir() {
        return Err(AppError::NotFound { path: root_fs_path });
    }
    let query = query.trim();
    if query.is_empty() {
        return Ok(SearchContentResult {
            matches: Vec::new(),
            scanned_files: 0,
            truncated: false,
        });
    }
    let opts = opts.unwrap_or_default();
    let max_size = opts.max_file_size_bytes.unwrap_or(DEFAULT_MAX_FILE_SIZE);
    let max_results = opts.max_results.unwrap_or(DEFAULT_MAX_RESULTS);
    let case_sensitive = opts.case_sensitive;

    search_sync(&root, query, case_sensitive, max_size, max_results, opts.include_hidden)
}

fn search_sync(
    root: &Path,
    query: &str,
    case_sensitive: bool,
    max_size: u64,
    max_results: usize,
    include_hidden: bool,
) -> AppResult<SearchContentResult> {
    let query_lower = query.to_lowercase();
    let walker = WalkDir::new(root)
        .follow_links(false)
        .skip_hidden(!include_hidden)
        .process_read_dir(|_, _, _, children| {
            children.retain(|entry_result| {
                let Ok(entry) = entry_result else { return true };
                let name = entry.file_name().to_string_lossy();
                name != TRASH_DIR
            });
        });

    let mut out = Vec::new();
    let mut scanned_files: u32 = 0;
    let mut truncated = false;

    for entry_result in walker {
        if out.len() >= max_results {
            truncated = true;
            break;
        }
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
        if size == 0 || size > max_size {
            continue;
        }
        let path = entry.path();
        scanned_files += 1;
        match find_in_file(&path, query, &query_lower, case_sensitive, max_results - out.len()) {
            Ok(mut file_matches) => {
                if !file_matches.is_empty() {
                    out.append(&mut file_matches);
                }
            }
            Err(_) => continue,
        }
    }

    Ok(SearchContentResult {
        matches: out,
        scanned_files,
        truncated,
    })
}

fn find_in_file(
    path: &Path,
    query: &str,
    query_lower: &str,
    case_sensitive: bool,
    remaining: usize,
) -> AppResult<Vec<ContentMatch>> {
    if remaining == 0 {
        return Ok(Vec::new());
    }
    let mut file = File::open(path).map_err(|e| AppError::Io(e.to_string()))?;

    // Binary sniff: read first 8KB, bail if it contains a NUL byte.
    let mut sniff = vec![0u8; BINARY_SNIFF_BYTES];
    let n = file
        .read(&mut sniff)
        .map_err(|e| AppError::Io(e.to_string()))?;
    sniff.truncate(n);
    if sniff.contains(&0u8) {
        return Ok(Vec::new());
    }
    // Quick check on the sniff: if query not present at all, and file is small enough
    // that the full content fits in sniff, we can bail early.
    let quick_hit = if case_sensitive {
        contains_bytes(&sniff, query.as_bytes())
    } else {
        contains_bytes_insensitive(&sniff, query_lower.as_bytes())
    };

    // Reopen from the start to run a line-aware scan.
    drop(file);
    let reopened = File::open(path).map_err(|e| AppError::Io(e.to_string()))?;
    let reader = BufReader::new(reopened);

    let mut out = Vec::new();
    let mut line_no: u32 = 0;
    for line_res in reader.lines() {
        if out.len() >= remaining {
            break;
        }
        line_no += 1;
        let line = match line_res {
            Ok(l) => l,
            Err(_) => continue,
        };
        let hit = if case_sensitive {
            line.contains(query)
        } else {
            line.to_lowercase().contains(query_lower)
        };
        if hit {
            let preview = truncate_preview(&line, 200);
            out.push(ContentMatch {
                path: path.to_string_lossy().into_owned(),
                line: line_no,
                preview,
            });
        }
    }
    // If quick hit said no and line-scan also said no, it's consistent.
    let _ = quick_hit;
    Ok(out)
}

fn contains_bytes(hay: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || needle.len() > hay.len() {
        return false;
    }
    hay.windows(needle.len()).any(|w| w == needle)
}

fn contains_bytes_insensitive(hay: &[u8], needle_lower: &[u8]) -> bool {
    if needle_lower.is_empty() || needle_lower.len() > hay.len() {
        return false;
    }
    // Only ASCII-aware lowercasing — good enough as a quick pre-filter.
    hay.windows(needle_lower.len()).any(|w| {
        w.iter().zip(needle_lower.iter()).all(|(h, n)| {
            let hl = if h.is_ascii_uppercase() { h + 32 } else { *h };
            hl == *n
        })
    })
}

fn truncate_preview(line: &str, limit: usize) -> String {
    let trimmed = line.trim_start();
    if trimmed.chars().count() <= limit {
        return trimmed.to_string();
    }
    let mut out = String::with_capacity(limit + 1);
    for (i, c) in trimmed.chars().enumerate() {
        if i >= limit {
            out.push('…');
            break;
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write(path: &Path, contents: &[u8]) {
        if let Some(p) = path.parent() {
            fs::create_dir_all(p).unwrap();
        }
        fs::write(path, contents).unwrap();
    }

    #[test]
    fn finds_text_in_plain_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.txt"), b"hello world\nfoo bar\n");
        write(&root.join("nested/b.txt"), b"no match here\nalso no\n");
        let r = search_sync(root, "hello", false, 1_000_000, 100, false).unwrap();
        assert_eq!(r.matches.len(), 1);
        assert_eq!(r.matches[0].line, 1);
    }

    #[test]
    fn case_insensitive_by_default() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.txt"), b"Hello World\n");
        let r = search_sync(root, "hello", false, 1_000_000, 100, false).unwrap();
        assert_eq!(r.matches.len(), 1);
    }

    #[test]
    fn case_sensitive_when_flag_set() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("a.txt"), b"Hello World\n");
        let r_sensitive = search_sync(root, "hello", true, 1_000_000, 100, false).unwrap();
        assert_eq!(r_sensitive.matches.len(), 0);
        let r_exact = search_sync(root, "Hello", true, 1_000_000, 100, false).unwrap();
        assert_eq!(r_exact.matches.len(), 1);
    }

    #[test]
    fn skips_binary_files() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let mut binary = vec![0u8; 100];
        binary.extend_from_slice(b"hello");
        write(&root.join("blob.bin"), &binary);
        let r = search_sync(root, "hello", false, 1_000_000, 100, false).unwrap();
        assert_eq!(r.matches.len(), 0);
    }

    #[test]
    fn skips_structura_trash() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join(".structura-trash/old.txt"), b"needle");
        write(&root.join("real.txt"), b"needle");
        let r = search_sync(root, "needle", false, 1_000_000, 100, false).unwrap();
        assert_eq!(r.matches.len(), 1);
        assert!(!r.matches[0].path.contains(".structura-trash"));
    }

    #[test]
    fn respects_max_results() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        for i in 0..20 {
            write(&root.join(format!("f{i}.txt")), b"needle\n");
        }
        let r = search_sync(root, "needle", false, 1_000_000, 5, false).unwrap();
        assert!(r.matches.len() <= 5);
        assert!(r.truncated || r.matches.len() == 5);
    }

    #[test]
    fn reports_multiple_lines_within_file() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(
            &root.join("multi.txt"),
            b"needle one\nother\nneedle two\nfoo\nneedle three\n",
        );
        let r = search_sync(root, "needle", false, 1_000_000, 100, false).unwrap();
        assert_eq!(r.matches.len(), 3);
        assert_eq!(r.matches[0].line, 1);
        assert_eq!(r.matches[1].line, 3);
        assert_eq!(r.matches[2].line, 5);
    }
}
