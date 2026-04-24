use std::path::{Path, PathBuf};

use crate::error::AppResult;
use crate::fs_ops::{copy_path, hardlink, mkdir, move_file, rename_path, rmdir_if_empty, soft_delete, symlink, touch};
use crate::model::{OpResult, OpStatus, Operation, Transaction, TxResult};

#[tauri::command]
pub async fn apply_transaction(tx: Transaction) -> AppResult<TxResult> {
    let root = PathBuf::from(&tx.root_fs_path);
    let mut results = Vec::with_capacity(tx.ops.len());

    for op in tx.ops.iter() {
        match execute(op, &root) {
            Ok(trash_path) => results.push(OpResult {
                op: op.clone(),
                status: OpStatus::Ok,
                error: None,
                trash_path: trash_path.map(|p| p.display().to_string()),
            }),
            Err(e) => {
                results.push(OpResult {
                    op: op.clone(),
                    status: OpStatus::Error,
                    error: Some(e.to_string()),
                    trash_path: None,
                });
                if !tx.continue_on_error {
                    break;
                }
            }
        }
    }

    Ok(TxResult {
        tx_id: tx.id,
        results,
        completed_at: chrono::Utc::now().timestamp_millis(),
    })
}

fn execute(op: &Operation, root: &Path) -> AppResult<Option<PathBuf>> {
    match op {
        Operation::Move { from, to } => {
            move_file(Path::new(from), Path::new(to), root)?;
            Ok(None)
        }
        Operation::Rename { path, new_name } => {
            rename_path(Path::new(path), new_name, root)?;
            Ok(None)
        }
        Operation::Delete { path, recursive } => {
            if *recursive {
                let trash = soft_delete(Path::new(path), root)?;
                Ok(Some(trash))
            } else {
                let p = Path::new(path);
                if p.is_dir() {
                    rmdir_if_empty(p, root)?;
                    Ok(None)
                } else {
                    let trash = soft_delete(p, root)?;
                    Ok(Some(trash))
                }
            }
        }
        Operation::Mkdir { path } => {
            mkdir(Path::new(path), root)?;
            Ok(None)
        }
        Operation::Touch { path } => {
            touch(Path::new(path), root)?;
            Ok(None)
        }
        Operation::Copy { from, to, recursive } => {
            copy_path(Path::new(from), Path::new(to), root, *recursive)?;
            Ok(None)
        }
        Operation::Symlink { from, to } => {
            symlink(Path::new(from), Path::new(to), root)?;
            Ok(None)
        }
        Operation::Hardlink { from, to } => {
            hardlink(Path::new(from), Path::new(to), root)?;
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn executes_move_and_cleanup() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let sub = root.join("a");
        std::fs::create_dir(&sub)?;
        std::fs::write(sub.join("x.txt"), "hi")?;

        execute(
            &Operation::Move {
                from: sub.join("x.txt").display().to_string(),
                to: root.join("x.txt").display().to_string(),
            },
            root,
        )?;
        execute(
            &Operation::Delete {
                path: sub.display().to_string(),
                recursive: false,
            },
            root,
        )?;
        assert!(root.join("x.txt").exists());
        assert!(!sub.exists());
        Ok(())
    }

    #[test]
    fn delete_returns_trash_path() -> AppResult<()> {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let file = root.join("victim.txt");
        std::fs::write(&file, "data")?;

        let trash_path = execute(
            &Operation::Delete {
                path: file.display().to_string(),
                recursive: false,
            },
            root,
        )?;
        let trash_path = trash_path.expect("soft-delete should return trash path");
        assert!(trash_path.exists());
        assert!(!file.exists());
        Ok(())
    }
}
