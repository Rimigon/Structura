use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Operation {
    #[serde(rename_all = "camelCase")]
    Move { from: String, to: String },
    #[serde(rename_all = "camelCase")]
    Rename { path: String, new_name: String },
    #[serde(rename_all = "camelCase")]
    Delete { path: String, recursive: bool },
    #[serde(rename_all = "camelCase")]
    Mkdir { path: String },
    #[serde(rename_all = "camelCase")]
    Touch { path: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub created_at: i64,
    pub label: String,
    pub root_fs_path: String,
    pub ops: Vec<Operation>,
    #[serde(default)]
    pub inverse: Vec<Operation>,
    #[serde(default)]
    pub continue_on_error: bool,
}
