use super::CopilotEndpoints;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotInternalSessionToken {
    pub token: String,
    pub expires_at: u64,
    pub endpoints: Option<CopilotEndpoints>,
}
