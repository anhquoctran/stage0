use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatGptAuthStatus {
    pub connected: bool,
    pub account_email: Option<String>,
    pub error: Option<String>,
}
