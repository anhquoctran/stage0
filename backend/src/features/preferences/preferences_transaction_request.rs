use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;
use zeroize::Zeroize;

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreferencesTransactionRequest {
    pub patch: Value,
    pub expected_revision: Option<String>,
    #[serde(default)]
    pub api_keys: BTreeMap<String, String>,
    #[serde(default)]
    pub api_key_removals: Vec<String>,
    #[serde(default)]
    pub mcp_env_secrets: BTreeMap<String, BTreeMap<String, String>>,
    #[serde(default)]
    pub mcp_env_removals: BTreeMap<String, Vec<String>>,
}

impl Drop for PreferencesTransactionRequest {
    fn drop(&mut self) {
        for value in self.api_keys.values_mut() {
            value.zeroize();
        }
        for env in self.mcp_env_secrets.values_mut() {
            for value in env.values_mut() {
                value.zeroize();
            }
        }
    }
}
