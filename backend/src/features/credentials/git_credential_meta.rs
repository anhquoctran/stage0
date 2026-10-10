use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCredentialMeta {
    pub id: String,
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_ref: String,
    pub token_type: String,
    pub label: Option<String>,
    pub source: String,
    pub helper_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_in_keyring: bool,
}
