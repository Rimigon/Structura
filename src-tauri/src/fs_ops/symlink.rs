use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

#[cfg(unix)]
fn platform_symlink(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(src, dst)
}

#[cfg(windows)]
fn platform_symlink(src: &Path, dst: &Path) -> std::io::Result<()> {
    match std::fs::metadata(src) {
        Ok(m) if m.is_dir() => std::os::windows::fs::symlink_dir(src, dst),
        _ => std::os::windows::fs::symlink_file(src, dst),
    }
}

pub fn symlink(from: &Path, to: &Path, root: &Path) -> AppResult<()> {
    assert_inside_root(from, root)?;
    assert_inside_root(to, root)?;

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

    platform_symlink(from, to).map_err(|e| {
        AppError::Io(format!(
            "symlink failed (on Windows requires admin or Developer Mode): {}",
            e
        ))
    })?;
    Ok(())
}

#[cfg(test)]
#[cfg(unix)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_symlink_to_file() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("target.txt");
        std::fs::write(&src, b"payload").unwrap();
        let link = root.join("link.txt");
        symlink(&src, &link, root)?;
        assert_eq!(std::fs::read(&link).unwrap(), b"payload");
        Ok(())
    }

    #[test]
    fn rejects_existing_target() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a");
        let dst = root.join("b");
        std::fs::write(&src, b"s").unwrap();
        std::fs::write(&dst, b"d").unwrap();
        let err = symlink(&src, &dst, root).unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists { .. }));
    }
}
