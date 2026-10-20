use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCredentialPreferenceRecord {
    pub id: String,
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_type: String,
    pub label: Option<String>,
    pub source: String,
    pub helper_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&super::GitCredentialMeta> for GitCredentialPreferenceRecord {
    fn from(value: &super::GitCredentialMeta) -> Self {
        Self {
            id: value.id.clone(),
            provider: value.provider.clone(),
            server_url: value.server_url.clone(),
            account_name: value.account_name.clone(),
            token_type: value.token_type.clone(),
            label: value.label.clone(),
            source: value.source.clone(),
            helper_name: value.helper_name.clone(),
            created_at: value.created_at.clone(),
            updated_at: value.updated_at.clone(),
        }
    }
}
