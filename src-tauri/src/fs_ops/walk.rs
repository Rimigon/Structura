use std::path::{Path, PathBuf};

use jwalk::WalkDir;

use crate::error::{AppError, AppResult};
use crate::model::{FsEntry, ScanOptions};

const TRASH_DIR: &str = ".structura-trash";

pub fn walk(root: &Path, opts: &ScanOptions) -> AppResult<Vec<FsEntry>> {
    let include_hidden = opts.include_hidden;
    let follow_symlinks = opts.follow_symlinks;
    let ignore_patterns = opts.ignore_patterns.clone();
    let max_depth = opts.max_depth.map(|d| d as usize).unwrap_or(usize::MAX);

    let mut builder = WalkDir::new(root)
        .follow_links(follow_symlinks)
        .skip_hidden(false)
        .max_depth(max_depth);

    let patterns = ignore_patterns.clone();
    builder = builder.process_read_dir(move |_depth, _path, _state, children| {
        children.retain(|dir_entry_result| {
            let Ok(entry) = dir_entry_result else {
                return true;
            };
            let name = entry.file_name().to_string_lossy();
            if name == TRASH_DIR {
                return false;
            }
            if !include_hidden && name.starts_with('.') {
                return false;
            }
            if patterns.iter().any(|p| name.contains(p)) {
                return false;
            }
            true
        });
    });

    let mut out = Vec::new();
    for entry_result in builder {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) if is_permission_denied(&e) => continue,
            Err(e) => return Err(AppError::Io(e.to_string())),
        };

        let path = entry.path();
        if path == root {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        let file_type = entry.file_type();
        let is_dir = file_type.is_dir();
        let is_symlink = file_type.is_symlink();

        if !follow_symlinks && is_symlink {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let ext = if is_dir {
            String::new()
        } else {
            path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default()
        };
        let rel_path = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| name.clone());

        out.push(FsEntry {
            path: path.to_string_lossy().into_owned(),
            rel_path,
            name,
            is_dir,
            size: if is_dir { 0 } else { meta.len() },
            modified: mtime_ms(&meta),
            ext,
        });
    }

    Ok(out)
}

fn is_permission_denied(e: &jwalk::Error) -> bool {
    e.io_error()
        .map(|io| io.kind() == std::io::ErrorKind::PermissionDenied)
        .unwrap_or(false)
}

pub fn stat(path: &Path) -> AppResult<FsEntry> {
    let meta = std::fs::symlink_metadata(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound {
            path: path.display().to_string(),
        },
        _ => AppError::Io(e.to_string()),
    })?;
    let is_dir = meta.is_dir();
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = if is_dir {
        String::new()
    } else {
        path.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    };
    Ok(FsEntry {
        path: path.to_string_lossy().into_owned(),
        rel_path: String::new(),
        name,
        is_dir,
        size: if is_dir { 0 } else { meta.len() },
        modified: mtime_ms(&meta),
        ext,
    })
}

fn mtime_ms(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn trash_dir_for(root: &Path) -> PathBuf {
    root.join(TRASH_DIR)
}
