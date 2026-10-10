use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub(super) struct GoogleTokenResponse {
    pub(super) access_token: String,
    pub(super) refresh_token: Option<String>,
    #[allow(dead_code)]
    pub(super) expires_in: Option<u64>,
    #[allow(dead_code)]
    pub(super) token_type: Option<String>,
}
