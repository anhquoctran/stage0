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
}
