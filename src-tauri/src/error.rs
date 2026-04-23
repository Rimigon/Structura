use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("path is outside the allowed root: {path}")]
    PathOutsideRoot { path: String, root: String },

    #[error("path already exists: {path}")]
    AlreadyExists { path: String },

    #[error("path not found: {path}")]
    NotFound { path: String },

    #[error("permission denied: {path}")]
    PermissionDenied { path: String },

    #[error("invalid name: {name}")]
    InvalidName { name: String },

    #[error("symlink escape attempted at {path}")]
    SymlinkEscape { path: String },

    #[error("dialog cancelled")]
    DialogCancelled,

    #[error("io error: {0}")]
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => AppError::Io(e.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::Io(e.to_string()),
            std::io::ErrorKind::AlreadyExists => AppError::Io(e.to_string()),
            _ => AppError::Io(e.to_string()),
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
