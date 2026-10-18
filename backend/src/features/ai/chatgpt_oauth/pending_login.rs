use super::auth_profile::AuthProfile;
use base64::Engine;
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

pub(super) struct PendingLogin {
    pub id: String,
    pub state: String,
    pub nonce: String,
    pub verifier: String,
    pub challenge: String,
    pub redirect: String,
    pub host_id: String,
    pub profile: AuthProfile,
}
impl PendingLogin {
    pub fn new(profile: AuthProfile, host_id: String, port: u16) -> Self {
        let random = || {
            format!(
                "{}{}",
                uuid::Uuid::new_v4().simple(),
                uuid::Uuid::new_v4().simple()
            )
        };
        let verifier = random();
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(verifier.as_bytes()));
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            state: random(),
            nonce: random(),
            verifier,
            challenge,
            redirect: format!("http://127.0.0.1:{port}/auth/callback"),
            host_id,
            profile,
        }
    }
}
impl Drop for PendingLogin {
    fn drop(&mut self) {
        self.verifier.zeroize();
        self.state.zeroize();
        self.nonce.zeroize();
    }
}
