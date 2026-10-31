use super::stored_session::StoredSession;
use serde::Deserialize;
use zeroize::Zeroize;

#[derive(Deserialize)]
pub(super) struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub scope: Option<String>,
    pub token_type: String,
    pub expires_in: u64,
}
impl TokenResponse {
    pub fn session(mut self, fallback_scopes: &[String]) -> Result<StoredSession, String> {
        if !self.token_type.eq_ignore_ascii_case("bearer")
            || self.access_token.is_empty()
            || self.access_token.len() > 32 * 1024
            || !self.access_token.bytes().all(|b| (33..=126).contains(&b))
            || self.expires_in == 0
            || self.expires_in > 86400
            || self.refresh_token.as_ref().is_some_and(|s| {
                s.is_empty() || s.len() > 32 * 1024 || !s.bytes().all(|b| (33..=126).contains(&b))
            })
            || self.scope.as_ref().is_some_and(|s| s.len() > 4096)
        {
            return Err(crate::common::messages::code(
                "backend.ai.chatgptInvalidCredentials",
            ));
        }
        Ok(StoredSession {
            access_token: std::mem::take(&mut self.access_token),
            refresh_token: self.refresh_token.take(),
            id_token: self.id_token.take(),
            scopes: self
                .scope
                .take()
                .map(|s| s.split_whitespace().map(str::to_string).collect())
                .unwrap_or_else(|| fallback_scopes.to_vec()),
            expires_at: chrono::Utc::now().timestamp() + self.expires_in as i64,
        })
    }
}
impl Drop for TokenResponse {
    fn drop(&mut self) {
        self.access_token.zeroize();
        self.refresh_token.zeroize();
        self.id_token.zeroize();
    }
}
