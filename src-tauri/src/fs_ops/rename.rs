use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::{assert_inside_root, is_valid_name};

pub fn rename_path(path: &Path, new_name: &str, root: &Path) -> AppResult<()> {
    if !is_valid_name(new_name) {
        return Err(AppError::InvalidName {
            name: new_name.to_string(),
        });
    }
    assert_inside_root(path, root)?;
    let parent = path.parent().ok_or_else(|| AppError::InvalidName {
        name: path.display().to_string(),
    })?;
    let target = parent.join(new_name);
    assert_inside_root(&target, root)?;
    if target.exists() {
        return Err(AppError::AlreadyExists {
            path: target.display().to_string(),
        });
    }
    std::fs::rename(path, target).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn renames_file() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let p = dir.path().join("a.txt");
        std::fs::write(&p, "hi")?;
        rename_path(&p, "b.txt", dir.path())?;
        assert!(dir.path().join("b.txt").exists());
        Ok(())
    }

    #[test]
    fn rejects_invalid_name() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let p = dir.path().join("a.txt");
        std::fs::write(&p, "hi")?;
        let err = rename_path(&p, "../escape", dir.path()).unwrap_err();
        assert!(matches!(err, AppError::InvalidName { .. }));
        Ok(())
    }
}
