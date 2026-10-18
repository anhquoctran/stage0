use super::{auth_profile::AuthProfile, stored_session::StoredSession};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const CATALOG: &str = "chatgpt_browser_v2_catalog";

#[derive(Serialize, Deserialize)]
pub(super) struct AuthCatalog {
    pub host_id: String,
    pub active: Option<String>,
    pub profiles: Vec<AuthProfile>,
}
pub(super) fn read_secret(key: &str) -> Result<Option<Zeroizing<String>>, String> {
    super::secret_storage::read(key)
}
impl AuthCatalog {
    pub fn load_for_sign_in(new_connection: bool) -> Result<Self, String> {
        match Self::load() {
            Err(error)
                if new_connection && error == super::secret_storage::LEGACY_ACCESS_REQUIRED =>
            {
                Ok(Self::fresh())
            }
            result => result,
        }
    }
    fn fresh() -> Self {
        Self {
            host_id: format!("urn:uuid:{}", uuid::Uuid::new_v4()),
            active: None,
            profiles: vec![],
        }
    }
    pub fn load() -> Result<Self, String> {
        match read_secret(CATALOG)? {
            Some(raw) => {
                let value: Self = serde_json::from_str(&raw)
                    .map_err(|_| "Saved ChatGPT registrations are invalid")?;
                if value.profiles.len() > 12
                    || uuid::Uuid::parse_str(value.host_id.trim_start_matches("urn:uuid:")).is_err()
                    || value.profiles.iter().any(|p| {
                        uuid::Uuid::parse_str(&p.id).is_err()
                            || !super::flow::issued_client(&p.client_id)
                    })
                {
                    return Err("Saved ChatGPT registration metadata is invalid".into());
                }
                Ok(value)
            }
            None => Ok(Self::fresh()),
        }
    }
    pub fn save(&mut self) -> Result<(), String> {
        let raw =
            serde_json::to_string(self).map_err(|_| "Could not encode ChatGPT registrations")?;
        super::secret_storage::write(CATALOG, &raw)
            .map_err(|_| "Could not save ChatGPT registrations to the OS keyring".into())
    }
    pub fn register(&mut self, profile: AuthProfile) -> Result<(), String> {
        if let Some(existing) = self.profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile;
        } else {
            if self.profiles.len() >= 12 {
                return Err("Saved registration limit reached".into());
            }
            self.profiles.push(profile);
        }
        self.save()
    }
    pub fn commit(
        &mut self,
        mut profile: AuthProfile,
        session: &StoredSession,
    ) -> Result<(), String> {
        let old = profile.secret.clone();
        let key = format!("chatgpt_browser_v2_session_{}", uuid::Uuid::new_v4());
        let raw = Zeroizing::new(
            serde_json::to_string(&session).map_err(|_| "Could not encode ChatGPT session")?,
        );
        super::secret_storage::write(&key, &raw)?;
        profile.secret = Some(key.clone());
        self.active = Some(profile.id.clone());
        if let Err(error) = self.register(profile) {
            let _ = super::secret_storage::delete(&key);
            return Err(error);
        }
        if let Some(old) = old {
            let _ = super::secret_storage::delete(&old);
        }
        Ok(())
    }
    pub fn clear_session(&mut self, id: &str) -> Result<(), String> {
        let profile = self
            .profiles
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or("Registration not found")?;
        let old = profile.secret.take();
        if self.active.as_deref() == Some(id) {
            self.active = None;
        }
        self.save()?;
        if let Some(key) = old {
            super::secret_storage::delete(&key)?;
        }
        Ok(())
    }
}
