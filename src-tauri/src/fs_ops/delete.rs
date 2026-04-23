use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};
use crate::fs_ops::move_file::move_file;
use crate::fs_ops::walk::trash_dir_for;
use crate::safety::assert_inside_root;

pub fn soft_delete(path: &Path, root: &Path) -> AppResult<PathBuf> {
    assert_inside_root(path, root)?;
    let trash = trash_dir_for(root);
    if !trash.exists() {
        std::fs::create_dir_all(&trash).map_err(|e| AppError::Io(e.to_string()))?;
    }
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::InvalidName {
            name: path.display().to_string(),
        })?;
    let ts = chrono::Utc::now().format("%Y%m%d-%H%M%S-%f").to_string();
    let target = trash.join(format!("{ts}__{name}"));
    move_file(path, &target, root)?;
    Ok(target)
}

pub fn rmdir_if_empty(path: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(path, root)?;
    let entries: Vec<_> = match std::fs::read_dir(path) {
        Ok(it) => it.collect(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(AppError::Io(e.to_string())),
    };
    if !entries.is_empty() {
        return Err(AppError::Io(format!(
            "directory not empty: {}",
            path.display()
        )));
    }
    std::fs::remove_dir(path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn soft_delete_moves_to_trash() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let p = dir.path().join("a.txt");
        std::fs::write(&p, "hi")?;
        let trash_path = soft_delete(&p, dir.path())?;
        assert!(!p.exists());
        assert!(trash_path.exists());
        let trash = trash_dir_for(dir.path());
        let entries: Vec<_> = std::fs::read_dir(&trash)?.collect();
        assert_eq!(entries.len(), 1);
        Ok(())
    }

    #[test]
    fn rmdir_removes_empty_dir() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub)?;
        rmdir_if_empty(&sub, dir.path())?;
        assert!(!sub.exists());
        Ok(())
    }

    #[test]
    fn rmdir_rejects_non_empty() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub)?;
        std::fs::write(sub.join("x.txt"), "x")?;
        assert!(rmdir_if_empty(&sub, dir.path()).is_err());
        Ok(())
    }
}
