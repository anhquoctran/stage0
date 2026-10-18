use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct IdClaims {
    pub sub: String,
    pub nonce: Option<String>,
    pub email: Option<String>,
    pub iat: i64,
    pub aud: serde_json::Value,
    pub azp: Option<String>,
}
