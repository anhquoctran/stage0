use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotEndpoints {
    pub api: Option<String>,
    pub proxy: Option<String>,
}
