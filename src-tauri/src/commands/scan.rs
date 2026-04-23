use std::path::PathBuf;

use crate::error::AppResult;
use crate::fs_ops::{stat, walk};
use crate::model::{FsEntry, ScanOptions};

#[tauri::command]
pub async fn scan_directory(path: String, opts: Option<ScanOptions>) -> AppResult<Vec<FsEntry>> {
    let root = PathBuf::from(path);
    walk(&root, &opts.unwrap_or_default())
}

#[tauri::command]
pub async fn stat_path(path: String) -> AppResult<FsEntry> {
    let p = PathBuf::from(path);
    stat(&p)
}
