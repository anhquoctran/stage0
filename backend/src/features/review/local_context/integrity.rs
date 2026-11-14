//! Process-scoped authentication: a disk row cannot invent immutable source.
use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;

pub(super) fn sign(secret: &[u8; 32], key: &str, body: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts a 32-byte key");
    mac.update(b"stage0-context-v1\0");
    mac.update(key.as_bytes());
    mac.update(&[0]);
    mac.update(body.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

pub(super) fn verify(secret: &[u8; 32], key: &str, body: &str, signature: &str) -> bool {
    let Ok(tag) = STANDARD.decode(signature) else {
        return false;
    };
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts a 32-byte key");
    mac.update(b"stage0-context-v1\0");
    mac.update(key.as_bytes());
    mac.update(&[0]);
    mac.update(body.as_bytes());
    mac.verify_slice(&tag).is_ok()
}
