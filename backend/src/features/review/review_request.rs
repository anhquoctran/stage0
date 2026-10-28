#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewRequest {
    pub session_id: String,
    pub provider: String,
    pub auth_mode: String,
    pub model: String,
    #[serde(default)]
    pub reasoning_effort: Option<String>,
    #[serde(default)]
    pub fast_mode: bool,
    #[serde(default = "default_execution_mode")]
    pub execution_mode: String,
    #[serde(default)]
    pub acp_agent: Option<crate::features::ai::acp::AcpAgentConfig>,
    #[serde(default)]
    pub acp_config_options: Option<serde_json::Value>,
    #[serde(default)]
    pub reviewer_id: Option<String>,
    #[serde(default)]
    pub reviewer_name: Option<String>,
    #[serde(default)]
    pub reviewer_role: Option<String>,
    pub base_url: String,
    pub instructions: String,
    pub allow_remote: bool,
    #[serde(default)]
    pub generate_description: bool,
    #[serde(default)]
    pub reply_discussion_id: Option<String>,
    #[serde(default)]
    pub manual_review_discussion_id: Option<String>,
    /// Rust overwrites this from global JSON preferences; it is never accepted over IPC.
    #[serde(skip)]
    pub agent_output_language: String,
}

fn default_execution_mode() -> String {
    "provider".into()
}
