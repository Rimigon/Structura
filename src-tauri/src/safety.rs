use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

pub fn canonicalize_safe(path: &Path) -> AppResult<PathBuf> {
    std::fs::canonicalize(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound {
            path: path.display().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied {
            path: path.display().to_string(),
        },
        _ => AppError::Io(e.to_string()),
    })
}

pub fn strip_long_prefix(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        p.to_path_buf()
    }
}

pub fn assert_inside_root(path: &Path, root: &Path) -> AppResult<()> {
    let normalized_root = strip_long_prefix(&canonicalize_safe(root)?);
    let normalized_path = if path.exists() {
        strip_long_prefix(&canonicalize_safe(path)?)
    } else {
        let (existing, tail) = split_at_first_existing(path).ok_or_else(|| {
            AppError::PathOutsideRoot {
                path: path.display().to_string(),
                root: root.display().to_string(),
            }
        })?;
        let existing_canon = strip_long_prefix(&canonicalize_safe(&existing)?);
        let mut joined = existing_canon;
        for part in tail {
            if part.as_os_str() == "." || part.as_os_str() == ".." {
                return Err(AppError::InvalidName {
                    name: path.display().to_string(),
                });
            }
            joined.push(part);
        }
        joined
    };
    if !normalized_path.starts_with(&normalized_root) {
        return Err(AppError::PathOutsideRoot {
            path: path.display().to_string(),
            root: root.display().to_string(),
        });
    }
    Ok(())
}

fn split_at_first_existing(path: &Path) -> Option<(PathBuf, Vec<PathBuf>)> {
    let mut tail: Vec<PathBuf> = Vec::new();
    let mut current: &Path = path;
    loop {
        if current.exists() {
            return Some((current.to_path_buf(), tail.into_iter().rev().collect()));
        }
        let name = current.file_name()?;
        tail.push(PathBuf::from(name));
        current = current.parent()?;
        if current.as_os_str().is_empty() {
            return None;
        }
    }
}

pub fn is_valid_name(name: &str) -> bool {
    if name.is_empty() || name == "." || name == ".." {
        return false;
    }
    !name.contains(['/', '\\', '\0'])
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn accepts_path_inside_root() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let child = root.join("child.txt");
        std::fs::write(&child, "hi")?;
        assert_inside_root(&child, root)?;
        Ok(())
    }

    #[test]
    fn rejects_path_outside_root() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let outside = root.parent().unwrap().to_path_buf();
        let err = assert_inside_root(&outside, root).unwrap_err();
        assert!(matches!(err, AppError::PathOutsideRoot { .. }));
    }

    #[test]
    fn rejects_bad_names() {
        assert!(!is_valid_name(""));
        assert!(!is_valid_name("."));
        assert!(!is_valid_name(".."));
        assert!(!is_valid_name("a/b"));
        assert!(!is_valid_name("a\\b"));
        assert!(is_valid_name("ok.txt"));
    }

    #[test]
    fn accepts_cyrillic_names_and_paths() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let cyr = dir.path().join("Рабочий стол");
        std::fs::create_dir(&cyr)?;
        let child = cyr.join("файл.txt");
        std::fs::write(&child, "привет")?;
        assert_inside_root(&child, &cyr)?;
        assert!(is_valid_name("Рабочий стол"));
        assert!(is_valid_name("файл.txt"));
        Ok(())
    }

    #[test]
    fn accepts_nonexistent_deep_paths_under_root() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let deep = dir.path().join("a").join("b").join("new.txt");
        assert_inside_root(&deep, dir.path())?;
        Ok(())
    }

    #[test]
    fn rejects_parent_escape_via_dotdot() {
        let dir = tempdir().unwrap();
        let escape = dir.path().join("sub").join("..").join("..").join("x");
        assert!(assert_inside_root(&escape, dir.path()).is_err());
    }

    #[test]
    fn strip_long_prefix_handles_both_variants() {
        let with = PathBuf::from(r"\\?\C:\Users\nikit");
        assert_eq!(strip_long_prefix(&with), PathBuf::from(r"C:\Users\nikit"));
        let without = PathBuf::from(r"C:\Users\nikit");
        assert_eq!(strip_long_prefix(&without), PathBuf::from(r"C:\Users\nikit"));
    }
}
