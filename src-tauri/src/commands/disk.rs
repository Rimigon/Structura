use std::path::{Path, PathBuf};

use fs2::available_space;
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskCheck {
    pub available: u64,
    pub required: u64,
    pub sufficient: bool,
}

#[tauri::command]
pub async fn check_disk_space(root_fs_path: String, required_bytes: u64) -> AppResult<DiskCheck> {
    check_sync(&PathBuf::from(&root_fs_path), required_bytes)
}

fn check_sync(path: &Path, required_bytes: u64) -> AppResult<DiskCheck> {
    let probe = first_existing_ancestor(path)
        .ok_or_else(|| AppError::Io(format!("no existing ancestor for {}", path.display())))?;
    let available = available_space(&probe).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(DiskCheck {
        available,
        required: required_bytes,
        sufficient: available >= required_bytes,
    })
}

fn first_existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current: Option<&Path> = Some(path);
    while let Some(p) = current {
        if p.exists() {
            return Some(p.to_path_buf());
        }
        current = p.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn reports_available_space_for_tempdir() {
        let dir = tempdir().unwrap();
        let check = check_sync(dir.path(), 0).unwrap();
        assert!(check.available > 0);
        assert!(check.sufficient);
    }

    #[test]
    fn insufficient_when_required_exceeds_available() {
        let dir = tempdir().unwrap();
        let check = check_sync(dir.path(), u64::MAX).unwrap();
        assert!(!check.sufficient);
    }

    #[test]
    fn walks_up_to_find_existing_ancestor() {
        let dir = tempdir().unwrap();
        let nonexistent = dir.path().join("does").join("not").join("exist");
        let check = check_sync(&nonexistent, 0).unwrap();
        assert!(check.available > 0);
    }
}
