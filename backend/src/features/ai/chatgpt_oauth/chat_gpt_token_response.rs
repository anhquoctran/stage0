use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub(super) struct ChatGptTokenResponse {
    pub(super) access_token: String,
    pub(super) refresh_token: Option<String>,
    pub(super) id_token: Option<String>,
    pub(super) issued_client_id: Option<String>,
    #[allow(dead_code)]
    pub(super) expires_in: Option<u64>,
}
