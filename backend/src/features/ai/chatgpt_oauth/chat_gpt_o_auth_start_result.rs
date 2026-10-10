use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatGptOAuthStartResult {
    pub auth_url: String,
    pub state: String,
    pub port: u16,
}
