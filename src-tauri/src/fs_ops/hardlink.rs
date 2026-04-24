use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

pub fn hardlink(from: &Path, to: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(from, root)?;
    assert_inside_root(to, root)?;

    let meta = std::fs::symlink_metadata(from).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound {
            path: from.display().to_string(),
        },
        _ => AppError::Io(e.to_string()),
    })?;
    if !meta.is_file() {
        return Err(AppError::Io(format!(
            "hardlink source must be a regular file: {}",
            from.display()
        )));
    }

    if to.exists() || std::fs::symlink_metadata(to).is_ok() {
        return Err(AppError::AlreadyExists {
            path: to.display().to_string(),
        });
    }

    if let Some(parent) = to.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }

    std::fs::hard_link(from, to).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_hardlink_with_same_content() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("original.bin");
        let dst = root.join("linked.bin");
        std::fs::write(&src, b"hello").unwrap();

        hardlink(&src, &dst, root)?;
        assert!(dst.is_file());
        assert_eq!(std::fs::read(&dst).unwrap(), b"hello");
        Ok(())
    }

    #[test]
    fn link_shares_inode_so_write_reflects_both() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a.bin");
        let dst = root.join("b.bin");
        std::fs::write(&src, b"v1").unwrap();
        hardlink(&src, &dst, root)?;

        std::fs::write(&src, b"v2").unwrap();
        assert_eq!(std::fs::read(&dst).unwrap(), b"v2");
        Ok(())
    }

    #[test]
    fn creates_parent_dirs_for_target() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("src.bin");
        std::fs::write(&src, b"x").unwrap();
        let dst = root.join("a/b/c.bin");
        hardlink(&src, &dst, root)?;
        assert!(dst.is_file());
        Ok(())
    }

    #[test]
    fn rejects_missing_source() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("nope.bin");
        let dst = root.join("dst.bin");
        let err = hardlink(&src, &dst, root).unwrap_err();
        assert!(matches!(err, AppError::NotFound { .. }));
    }

    #[test]
    fn rejects_existing_target() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a.bin");
        let dst = root.join("b.bin");
        std::fs::write(&src, b"s").unwrap();
        std::fs::write(&dst, b"d").unwrap();
        let err = hardlink(&src, &dst, root).unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists { .. }));
    }

    #[test]
    fn rejects_directory_source() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("folder");
        std::fs::create_dir(&src).unwrap();
        let dst = root.join("link");
        let err = hardlink(&src, &dst, root).unwrap_err();
        assert!(matches!(err, AppError::Io(_)));
    }
}
