use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

pub fn move_file(from: &Path, to: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(from, root)?;
    assert_inside_root(to, root)?;
    if to.exists() {
        return Err(AppError::AlreadyExists {
            path: to.display().to_string(),
        });
    }
    if let Some(parent) = to.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }
    match std::fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::CrossesDevices => {
            std::fs::copy(from, to).map_err(|e| AppError::Io(e.to_string()))?;
            std::fs::remove_file(from).map_err(|e| AppError::Io(e.to_string()))?;
            Ok(())
        }
        Err(e) => Err(AppError::Io(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn moves_within_root() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let from = dir.path().join("a.txt");
        let to = dir.path().join("b.txt");
        std::fs::write(&from, "hi")?;
        move_file(&from, &to, dir.path())?;
        assert!(!from.exists());
        assert_eq!(std::fs::read_to_string(&to)?, "hi");
        Ok(())
    }

    #[test]
    fn rejects_existing_target() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let from = dir.path().join("a.txt");
        let to = dir.path().join("b.txt");
        std::fs::write(&from, "hi")?;
        std::fs::write(&to, "bye")?;
        let err = move_file(&from, &to, dir.path()).unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists { .. }));
        Ok(())
    }
}
