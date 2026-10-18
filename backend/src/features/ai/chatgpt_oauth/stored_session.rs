use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Serialize, Deserialize)]
pub(super) struct StoredSession {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub scopes: Vec<String>,
    pub expires_at: i64,
}
impl StoredSession {
    pub fn plan_usage(&self) -> bool {
        self.expires_at > chrono::Utc::now().timestamp()
            && ["resource.invoke", "chatgpt.tokens.use.direct"]
                .iter()
                .all(|scope| self.scopes.iter().any(|s| s == scope))
    }
}
impl Drop for StoredSession {
    fn drop(&mut self) {
        self.access_token.zeroize();
        self.refresh_token.zeroize();
        self.id_token.zeroize();
    }
}
