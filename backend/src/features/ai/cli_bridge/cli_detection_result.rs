use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliDetectionResult {
    pub cli_type: String,
    pub available: bool,
    pub version: Option<String>,
    pub logged_in: bool,
    pub auth_info: Option<String>,
    pub executable_path: Option<String>,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error: Option<String>,
}
