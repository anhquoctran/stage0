use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotAuthStatus {
    pub connected: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub has_subscription: bool,
    pub expires_at: Option<u64>,
    #[serde(serialize_with = "crate::common::messages::serialize_optional_error")]
    pub error: Option<String>,
}
