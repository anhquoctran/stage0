use serde::Deserialize;

#[derive(Deserialize, Clone, Debug)]
pub struct SaveGitCredentialPayload {
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_type: String,
    pub label: Option<String>,
    pub secret: String,
}
