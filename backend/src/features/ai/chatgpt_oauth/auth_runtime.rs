use super::{
    auth_catalog::AuthCatalog, chat_gpt_auth_status::ChatGptAuthStatus,
    public_profile::PublicProfile, stored_session::StoredSession,
};

pub(super) struct AuthRuntime {
    pub pending: Option<String>,
    pub cancel: Option<tokio::sync::oneshot::Sender<()>>,
    pub phase: String,
    pub error: Option<String>,
    cached_status: Option<ChatGptAuthStatus>,
    expires_at: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cached_authentication_expires_without_reading_or_refreshing_credentials() {
        let mut runtime = AuthRuntime::new();
        let mut status = runtime.status();
        status.connected = true;
        status.plan_usage_enabled = true;
        status.credentials_loaded = true;
        runtime.cached_status = Some(status);
        runtime.expires_at = Some(chrono::Utc::now().timestamp() - 1);
        runtime.phase = "signed_in".into();
        let expired = runtime.status();
        assert!(!expired.connected && !expired.plan_usage_enabled);
        assert_eq!(expired.phase, "signed_out");
        runtime.phase = "pending".into();
        assert_eq!(runtime.status().phase, "pending");
    }
}
impl AuthRuntime {
    pub const fn new() -> Self {
        Self {
            pending: None,
            cancel: None,
            phase: String::new(),
            error: None,
            cached_status: None,
            expires_at: None,
        }
    }
    // Only explicit authentication actions hydrate this public metadata cache.
    // Never retain access/refresh tokens in the polling runtime.
    pub fn snapshot(&mut self, catalog: &AuthCatalog) -> Result<ChatGptAuthStatus, String> {
        let active = catalog
            .profiles
            .iter()
            .find(|p| Some(&p.id) == catalog.active.as_ref());
        let session = active.map(|p| p.session()).transpose()?.flatten();
        Ok(self.snapshot_with_session(catalog, session.as_ref()))
    }

    pub fn snapshot_with_session(
        &mut self,
        catalog: &AuthCatalog,
        session: Option<&StoredSession>,
    ) -> ChatGptAuthStatus {
        let active = catalog
            .profiles
            .iter()
            .find(|p| Some(&p.id) == catalog.active.as_ref());
        let connected = session.is_some_and(|s| s.expires_at > chrono::Utc::now().timestamp());
        let profiles = catalog
            .profiles
            .iter()
            .enumerate()
            .map(|(index, p)| PublicProfile {
                id: p.id.clone(),
                label: format!("Connection {} · {}", index + 1, &p.id[..8]),
                email: p.email.clone(),
                signed_in: p.secret.is_some(),
            })
            .collect();
        self.expires_at = session.map(|s| s.expires_at);
        self.cached_status = Some(ChatGptAuthStatus {
            connected,
            account_email: active.and_then(|p| p.email.clone()),
            error: self.error.clone(),
            phase: if self.phase.is_empty() {
                if connected { "signed_in" } else { "signed_out" }.into()
            } else {
                self.phase.clone()
            },
            attempt_id: self.pending.clone(),
            active_profile_id: catalog.active.clone(),
            plan_usage_enabled: session.as_ref().is_some_and(|s| s.plan_usage()),
            profiles,
            credentials_loaded: true,
        });
        self.status()
    }

    // Passive polling must not open the keyring or refresh credentials.
    pub fn status(&self) -> ChatGptAuthStatus {
        let mut status = self.cached_status.clone().unwrap_or(ChatGptAuthStatus {
            connected: false,
            account_email: None,
            error: None,
            phase: "signed_out".into(),
            attempt_id: None,
            active_profile_id: None,
            plan_usage_enabled: false,
            profiles: vec![],
            credentials_loaded: false,
        });
        if self
            .expires_at
            .is_some_and(|expiry| expiry <= chrono::Utc::now().timestamp())
        {
            status.connected = false;
            status.plan_usage_enabled = false;
            if status.phase == "signed_in" {
                status.phase = "signed_out".into();
            }
        }
        if !self.phase.is_empty() {
            status.phase = self.phase.clone();
        }
        if !status.connected && status.phase == "signed_in" {
            status.phase = "signed_out".into();
        }
        status.error = self.error.clone();
        status.attempt_id = self.pending.clone();
        status
    }

    // Fail closed even if keyring deletion partially succeeds then reports an error.
    pub fn forget_session(&mut self, id: &str) {
        if let Some(status) = &mut self.cached_status {
            for profile in &mut status.profiles {
                if profile.id == id {
                    profile.signed_in = false;
                }
            }
            if status.active_profile_id.as_deref() == Some(id) {
                status.connected = false;
                status.plan_usage_enabled = false;
                status.active_profile_id = None;
                status.account_email = None;
                self.expires_at = None;
            }
        }
    }
}
