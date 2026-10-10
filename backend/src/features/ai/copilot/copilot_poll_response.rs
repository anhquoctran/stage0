use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotPollResponse {
    pub status: String, // "authorized", "pending", "slow_down", "expired", "error"
    pub access_token: Option<String>,
    pub error_message: Option<String>,
}
