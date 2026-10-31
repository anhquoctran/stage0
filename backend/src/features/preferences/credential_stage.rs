//! Copy-on-write credential preparation. No existing keychain item is modified.
use super::PreferencesTransactionRequest;
use crate::core::db::Database;
use crate::features::credentials::{self, preference_snapshot};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use zeroize::Zeroizing;

pub(super) fn validate(request: &PreferencesTransactionRequest) -> Result<(), String> {
    let provider = |p: &str| {
        matches!(
            p,
            "openai"
                | "anthropic"
                | "gemini"
                | "xai_grok"
                | "deepseek"
                | "qwen"
                | "kimi"
                | "ollama"
                | "custom"
                | "zai"
                | "z_ai"
                | "opencode"
        )
    };
    if request.api_keys.len() + request.api_key_removals.len() > 16
        || request
            .api_keys
            .iter()
            .any(|(p, k)| !provider(p) || k.trim().is_empty() || k.len() > 8192)
        || request
            .api_key_removals
            .iter()
            .any(|p| !provider(p) || request.api_keys.contains_key(p))
        || request
            .api_key_removals
            .iter()
            .collect::<BTreeSet<_>>()
            .len()
            != request.api_key_removals.len()
    {
        return Err(crate::common::messages::failure(
            "backend.preferences.invalidAiCredentialChanges",
            serde_json::json!({}),
            "Invalid AI credential changes".into(),
        ));
    }
    if request.mcp_env_secrets.len() + request.mcp_env_removals.len() > 256 {
        return Err(crate::common::messages::failure(
            "backend.preferences.tooManyMcpCredentialChanges",
            serde_json::json!({}),
            "Too many MCP credential changes".into(),
        ));
    }
    for (id, env) in &request.mcp_env_secrets {
        if !valid_id(id)
            || env.len() > 256
            || env
                .iter()
                .any(|(k, v)| !valid_name(k) || v.trim().is_empty() || v.len() > 16384)
        {
            return Err(crate::common::messages::failure(
                "backend.preferences.invalidMcpCredentialChanges",
                serde_json::json!({}),
                "Invalid MCP credential changes".into(),
            ));
        }
    }
    for (id, names) in &request.mcp_env_removals {
        if !valid_id(id) || names.len() > 256 || names.iter().any(|n| !valid_name(n)) {
            return Err(crate::common::messages::failure(
                "backend.preferences.invalidMcpCredentialRemovals",
                serde_json::json!({}),
                "Invalid MCP credential removals".into(),
            ));
        }
    }
    Ok(())
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 256 && !id.chars().any(char::is_control)
}
fn valid_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c=='_' || c.is_ascii_alphabetic())
        && chars.all(|c| c == '_' || c.is_ascii_alphanumeric())
}

fn stage(db: &Database, value: &str) -> Result<Value, String> {
    let id = format!("txn/{}", uuid::Uuid::new_v4().simple());
    let reference = format!("st0_pref_{}", uuid::Uuid::new_v4().simple());
    db.stage_preference_secret_ref(&id, &reference)?;
    credentials::store_preference_secret(&reference, value)?;
    Ok(Value::String(id))
}

pub(super) fn prepare(
    db: &Database,
    candidate: &Value,
    request: &PreferencesTransactionRequest,
) -> Result<Value, String> {
    prepare_with(
        candidate,
        request,
        |logical| match preference_snapshot::read(db, candidate, logical)? {
            Some(value) => Ok(value),
            None => db
                .get_preference_secret_ref(logical)
                .map_err(|_| {
                    crate::common::messages::failure(
                        "backend.preferences.readMcpMappingFailed",
                        serde_json::json!({}),
                        "Could not read MCP credential mapping".into(),
                    )
                })?
                .map(|reference| {
                    credentials::retrieve_preference_secret(&reference).map(Zeroizing::new)
                })
                .transpose(),
        },
        |value| stage(db, value),
    )
}

pub(super) fn prepare_with(
    candidate: &Value,
    request: &PreferencesTransactionRequest,
    read: impl Fn(&str) -> Result<Option<Zeroizing<String>>, String>,
    write: impl Fn(&str) -> Result<Value, String>,
) -> Result<Value, String> {
    let mut references = candidate
        .get("credentialReferences")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    for (provider, key) in &request.api_keys {
        references.insert(format!("ai/{provider}"), write(key.trim())?);
    }
    for provider in &request.api_key_removals {
        references.insert(format!("ai/{provider}"), Value::Null);
    }
    let servers: BTreeSet<_> = request
        .mcp_env_secrets
        .keys()
        .chain(request.mcp_env_removals.keys())
        .collect();
    for server in servers {
        let logical = format!("mcp_server/{server}");
        let previous = read(&logical)?;
        let mut env: BTreeMap<String, Zeroizing<String>> = match previous {
            Some(record) => serde_json::from_str::<BTreeMap<String, String>>(&record)
                .map_err(|_| {
                    crate::common::messages::failure(
                        "backend.preferences.savedMcpCredentialsInvalid",
                        serde_json::json!({}),
                        "Saved MCP credentials are invalid".into(),
                    )
                })?
                .into_iter()
                .map(|(k, v)| (k, Zeroizing::new(v)))
                .collect(),
            None => BTreeMap::new(),
        };
        if let Some(names) = request.mcp_env_removals.get(server) {
            for name in names {
                env.remove(name);
            }
        }
        if let Some(values) = request.mcp_env_secrets.get(server) {
            for (name, value) in values {
                env.insert(name.clone(), Zeroizing::new(value.trim().to_string()));
            }
        }
        let value = if env.is_empty() {
            Value::Null
        } else {
            // Serialize directly into a zeroizing buffer; no credential value enters preferences JSON.
            let public: BTreeMap<_, _> =
                env.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
            let record = Zeroizing::new(serde_json::to_string(&public).map_err(|_| {
                crate::common::messages::failure(
                    "backend.preferences.encodeMcpCredentialsFailed",
                    serde_json::json!({}),
                    "Could not encode MCP credentials".into(),
                )
            })?);
            if record.len() > 2048 {
                return Err(crate::common::messages::failure(
                    "backend.preferences.mcpRecordSizeLimit",
                    serde_json::json!({}),
                    "MCP credential record exceeds the supported size limit".into(),
                ));
            }
            write(&record)?
        };
        references.insert(logical, value);
    }
    if request.api_keys.is_empty() && request.api_key_removals.is_empty() && servers_empty(request)
    {
        return Ok(Value::Null);
    }
    Ok(json!({"credentialReferences": references}))
}

fn servers_empty(request: &PreferencesTransactionRequest) -> bool {
    request.mcp_env_secrets.is_empty() && request.mcp_env_removals.is_empty()
}

pub(super) fn configured(request: &PreferencesTransactionRequest) -> BTreeMap<String, bool> {
    request
        .api_keys
        .keys()
        .map(|p| (p.clone(), true))
        .chain(request.api_key_removals.iter().map(|p| (p.clone(), false)))
        .collect()
}

pub(super) fn referenced(settings: &Value) -> BTreeSet<String> {
    settings
        .get("credentialReferences")
        .and_then(Value::as_object)
        .unwrap_or(&Map::new())
        .values()
        .filter_map(Value::as_str)
        .map(str::to_string)
        .collect()
}
