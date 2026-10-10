use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedAiChatResponse {
    pub success: bool,
    pub content: String,
    pub duration_ms: u64,
    pub provider_used: String,
    pub error: Option<String>,
}
