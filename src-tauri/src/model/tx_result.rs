use serde::Serialize;

use super::operation::Operation;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OpStatus {
    Ok,
    Skipped,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpResult {
    pub op: Operation,
    pub status: OpStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trash_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TxResult {
    pub tx_id: String,
    pub results: Vec<OpResult>,
    pub completed_at: i64,
}
