use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthStatus {
    pub connected: bool,
    pub account_email: Option<String>,
    pub auth_method: String, // "oauth_pkce", "gcloud_adc", "none"
    pub error: Option<String>,
}
