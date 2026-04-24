use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::safety::assert_inside_root;

pub fn copy_path(from: &Path, to: &Path, root: &Path, recursive: bool) -> AppResult<()> {
    assert_inside_root(from, root)?;
    assert_inside_root(to, root)?;

    let meta = std::fs::symlink_metadata(from).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound {
            path: from.display().to_string(),
        },
        _ => AppError::Io(e.to_string()),
    })?;

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

    if meta.is_dir() {
        if !recursive {
            return Err(AppError::Io(format!(
                "source is a directory; recursive=true required: {}",
                from.display()
            )));
        }
        copy_dir_recursive(from, to)?;
    } else if meta.is_file() {
        std::fs::copy(from, to).map_err(|e| AppError::Io(e.to_string()))?;
    } else {
        return Err(AppError::Io(format!(
            "unsupported source kind: {}",
            from.display()
        )));
    }

    Ok(())
}

fn copy_dir_recursive(from: &Path, to: &Path) -> AppResult<()> {
    std::fs::create_dir(to).map_err(|e| AppError::Io(e.to_string()))?;
    for entry in std::fs::read_dir(from).map_err(|e| AppError::Io(e.to_string()))? {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let ft = entry.file_type().map_err(|e| AppError::Io(e.to_string()))?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        if ft.is_dir() {
            copy_dir_recursive(&src, &dst)?;
        } else if ft.is_file() {
            std::fs::copy(&src, &dst).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn copies_file() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a.txt");
        std::fs::write(&src, b"payload").unwrap();
        let dst = root.join("b.txt");
        copy_path(&src, &dst, root, false)?;
        assert_eq!(std::fs::read(&dst).unwrap(), b"payload");
        assert!(src.exists());
        Ok(())
    }

    #[test]
    fn copies_dir_recursively() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("src");
        std::fs::create_dir_all(src.join("nested")).unwrap();
        std::fs::write(src.join("top.txt"), b"1").unwrap();
        std::fs::write(src.join("nested/deep.txt"), b"2").unwrap();

        let dst = root.join("dst");
        copy_path(&src, &dst, root, true)?;
        assert!(dst.join("top.txt").is_file());
        assert!(dst.join("nested/deep.txt").is_file());
        assert_eq!(std::fs::read(dst.join("nested/deep.txt")).unwrap(), b"2");
        Ok(())
    }

    #[test]
    fn refuses_dir_without_recursive_flag() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("folder");
        std::fs::create_dir(&src).unwrap();
        let dst = root.join("copy");
        let err = copy_path(&src, &dst, root, false).unwrap_err();
        assert!(matches!(err, AppError::Io(_)));
    }

    #[test]
    fn refuses_existing_target() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a.txt");
        let dst = root.join("b.txt");
        std::fs::write(&src, b"s").unwrap();
        std::fs::write(&dst, b"d").unwrap();
        let err = copy_path(&src, &dst, root, false).unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists { .. }));
    }

    #[test]
    fn creates_missing_parent() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let src = root.join("a.txt");
        std::fs::write(&src, b"x").unwrap();
        let dst = root.join("deep/parent/b.txt");
        copy_path(&src, &dst, root, false)?;
        assert!(dst.is_file());
        Ok(())
    }
}
