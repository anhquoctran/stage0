use super::stored_session::StoredSession;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub(super) struct AuthProfile {
    pub id: String,
    pub client_id: String,
    pub subject: Option<String>,
    pub email: Option<String>,
    pub secret: Option<String>,
}
impl AuthProfile {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            client_id: super::DYNAMIC_CLIENT.into(),
            subject: None,
            email: None,
            secret: None,
        }
    }
    pub fn session(&self) -> Result<Option<StoredSession>, String> {
        self.secret
            .as_deref()
            .map(super::auth_catalog::read_secret)
            .transpose()?
            .flatten()
            .map(|raw| {
                serde_json::from_str(&raw)
                    .map_err(|_| crate::common::messages::failure("backend.ai.chatGptSavedSessionInvalid", serde_json::json!({}), "Saved ChatGPT session is invalid. Sign in again.".into()))
            })
            .transpose()
    }
}
