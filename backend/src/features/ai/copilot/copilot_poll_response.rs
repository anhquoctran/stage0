use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotPollResponse {
    pub status: String, // "authorized", "pending", "slow_down", "expired", "error"
    pub access_token: Option<String>,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error_message: Option<String>,
}
