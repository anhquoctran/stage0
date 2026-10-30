use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliExecutionResult {
    pub success: bool,
    pub output: String,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error: Option<String>,
    pub duration_ms: u64,
}
