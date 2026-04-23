use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

pub fn touch(path: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(path, root)?;
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }
    std::fs::File::create(path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_empty_file() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let target = dir.path().join("notes.txt");
        touch(&target, dir.path())?;
        assert!(target.is_file());
        assert_eq!(std::fs::metadata(&target).unwrap().len(), 0);
        Ok(())
    }

    #[test]
    fn creates_parents_if_missing() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let target = dir.path().join("a/b/c.txt");
        touch(&target, dir.path())?;
        assert!(target.is_file());
        Ok(())
    }

    #[test]
    fn idempotent() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let target = dir.path().join("x.txt");
        touch(&target, dir.path())?;
        std::fs::write(&target, b"content").unwrap();
        touch(&target, dir.path())?;
        let bytes = std::fs::read(&target).unwrap();
        assert_eq!(bytes, b"content");
        Ok(())
    }
}
