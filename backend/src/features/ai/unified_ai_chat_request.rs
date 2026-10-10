use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedAiChatRequest {
    pub provider: String,
    pub auth_mode: String, // "cli_bridge", "subscription_oauth", "api_key"
    pub model: Option<String>,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub repo_path: Option<String>,
}
