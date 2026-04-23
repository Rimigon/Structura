use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub path: String,
    pub rel_path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
    pub ext: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScanOptions {
    pub max_depth: Option<u32>,
    pub follow_symlinks: bool,
    pub include_hidden: bool,
    pub ignore_patterns: Vec<String>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            max_depth: None,
            follow_symlinks: false,
            include_hidden: false,
            ignore_patterns: Vec::new(),
        }
    }
}
