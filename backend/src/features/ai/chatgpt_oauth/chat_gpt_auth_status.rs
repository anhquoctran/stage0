use super::public_profile::PublicProfile;
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct ChatGptAuthStatus {
    pub connected: bool,
    pub account_email: Option<String>,
    pub error: Option<String>,
    pub phase: String,
    pub attempt_id: Option<String>,
    pub active_profile_id: Option<String>,
    pub plan_usage_enabled: bool,
    pub profiles: Vec<PublicProfile>,
    pub credentials_loaded: bool,
}
