use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

pub fn mkdir(path: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(path, root)?;
    if path.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_dir() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("new/deep");
        mkdir(&sub, dir.path())?;
        assert!(sub.is_dir());
        Ok(())
    }

    #[test]
    fn idempotent() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("new");
        mkdir(&sub, dir.path())?;
        mkdir(&sub, dir.path())?;
        Ok(())
    }
}
