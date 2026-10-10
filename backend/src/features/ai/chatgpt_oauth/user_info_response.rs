use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub(super) struct UserInfoResponse {
    pub(super) email: Option<String>,
    pub(super) preferred_username: Option<String>,
    pub(super) name: Option<String>,
}
