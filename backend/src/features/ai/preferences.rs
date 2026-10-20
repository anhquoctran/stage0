use super::keyring_write_progress::KeyringWriteProgress;
use crate::features::sandbox::{guardrails::GuardrailPolicy, manager::SandboxManager};
use std::collections::{BTreeMap, BTreeSet};
use tauri::Manager;
use zeroize::Zeroizing;

static COMMIT: std::sync::Mutex<()> = std::sync::Mutex::new(());

// Read every old key before writing anything. Never send previous secrets to the WebView.
fn apply_keys(
    keys: &BTreeMap<String, Zeroizing<String>>,
    read: impl Fn(&str) -> Result<Option<String>, String>,
    write: impl Fn(&str, Option<&str>) -> Result<(), String>,
) -> Result<(BTreeMap<String, bool>, BTreeMap<String, Option<Zeroizing<String>>>), String> {
    if keys.len() > 7
        || keys.iter().any(|(provider, key)| {
            !matches!(
                provider.as_str(),
                "openai"
                    | "anthropic"
                    | "github_copilot"
                    | "gemini"
                    | "xai_grok"
                    | "ollama"
                    | "custom"
            ) || key.trim().is_empty()
                || key.len() > 8192
        })
    {
        return Err("Invalid AI provider key changes. Nothing was saved.".into());
    }
    if keys.is_empty() {
        return Ok((BTreeMap::new(), BTreeMap::new()));
    }
    let mut progress = KeyringWriteProgress::new("ai_api_key_batch", "native_single", keys.len());
    progress.stage("read_previous_keys");
    let mut previous = BTreeMap::new();
    for provider in keys.keys() {
        previous.insert(provider.clone(), read(provider)?.map(Zeroizing::new));
    }
    let mut changed: Vec<&String> = vec![];
    for (provider, key) in keys {
        changed.push(provider);
        if progress
            .write_item("api_key", || write(provider, Some(key.trim())))
            .is_err()
        {
            let mut restored = true;
            for provider in changed.into_iter().rev() {
                if progress
                    .rollback_item(|| {
                        write(provider, previous[provider].as_ref().map(|s| s.as_str()))
                    })
                    .is_err()
                {
                    restored = false;
                }
            }
            return Err(if restored { "Could not save AI keys to the OS keyring. Previous keys were restored; preferences were not applied." } else { "AI key save failed and keyring rollback was incomplete. Check the OS credential store before retrying." }.into());
        }
    }
    progress.commit();
    Ok((
        keys.keys().map(|provider| (provider.clone(), true)).collect(),
        previous,
    ))
}

fn restore_ai_keys(
    previous: &BTreeMap<String, Option<Zeroizing<String>>>,
    write: impl Fn(&str, Option<&str>) -> Result<(), String>,
) -> Result<(), String> {
    let mut restored = true;
    for (provider, key) in previous.iter().rev() {
        if write(provider, key.as_ref().map(|value| value.as_str())).is_err() {
            restored = false;
        }
    }
    if restored {
        Ok(())
    } else {
        Err("AI key rollback was incomplete".into())
    }
}

fn valid_mcp_server_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 256 && !id.chars().any(char::is_control)
}

fn valid_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(first) if first == '_' || first.is_ascii_alphabetic())
        && chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

/// Resolves a configured server's keychain-backed variables only inside the
/// native backend. A future MCP process runner must pass this map directly to
/// process environment construction and must never expose it through IPC/logs.
pub fn resolve_mcp_server_env(
    db: &crate::core::db::Database,
    server_id: &str,
    public_env: &BTreeMap<String, String>,
    secret_env_keys: &[String],
) -> Result<BTreeMap<String, Zeroizing<String>>, String> {
    resolve_mcp_env_with_record(server_id, public_env, secret_env_keys, |server_id| {
        let id = format!("mcp_server/{server_id}");
        let reference = db
            .get_preference_secret_ref(&id)
            .map_err(|_| "Could not read the MCP credential mapping")?;
        match reference {
            Some(reference) => crate::features::credentials::retrieve_preference_secret(&reference)
                .map(Some),
            None => Ok(None),
        }
    })
}

fn resolve_mcp_env_with_record(
    server_id: &str,
    public_env: &BTreeMap<String, String>,
    secret_env_keys: &[String],
    read: impl FnOnce(&str) -> Result<Option<String>, String>,
) -> Result<BTreeMap<String, Zeroizing<String>>, String> {
    if !valid_mcp_server_id(server_id)
        || public_env.len() > 256
        || public_env.iter().any(|(name, value)| {
            !valid_env_name(name) || value.len() > 16_384 || secret_env_keys.contains(name)
        })
        || secret_env_keys.len() > 256
        || secret_env_keys.iter().any(|name| !valid_env_name(name))
        || secret_env_keys.iter().collect::<BTreeSet<_>>().len() != secret_env_keys.len()
    {
        return Err("Invalid MCP server environment configuration.".into());
    }
    let mut resolved = public_env
        .iter()
        .map(|(name, value)| (name.clone(), Zeroizing::new(value.clone())))
        .collect::<BTreeMap<_, _>>();
    if secret_env_keys.is_empty() {
        return Ok(resolved);
    }
    let record = Zeroizing::new(
        read(server_id)?
            .ok_or("The MCP server has no saved OS-keychain credential record.")?,
    );
    if record.len() > 2_048 {
        return Err("The saved MCP credential record exceeds the supported size limit.".into());
    }
    let mut values = match serde_json::from_str::<BTreeMap<String, String>>(&record) {
        Ok(values) => values,
        Err(_) => return Err("The saved MCP credential record is invalid.".into()),
    };
    if values.len() > 256 || values.iter().any(|(name, value)| !valid_env_name(name) || value.len() > 16_384) {
        for value in values.values_mut() {
            zeroize::Zeroize::zeroize(value);
        }
        return Err("The saved MCP credential record is outside supported limits.".into());
    }
    for name in secret_env_keys {
        match values.remove(name) {
            Some(value) if !value.is_empty() => {
                resolved.insert(name.clone(), Zeroizing::new(value));
            }
            _ => {
                for value in values.values_mut() {
                    zeroize::Zeroize::zeroize(value);
                }
                return Err("A configured MCP secret is missing from the OS keychain.".into());
            }
        }
    }
    for value in values.values_mut() {
        zeroize::Zeroize::zeroize(value);
    }
    Ok(resolved)
}

fn apply_mcp_env_changes(
    updates: &BTreeMap<String, BTreeMap<String, Zeroizing<String>>>,
    removals: &BTreeMap<String, Vec<String>>,
    read: impl Fn(&str) -> Result<Option<String>, String>,
    write: impl Fn(&str, Option<&str>) -> Result<(), String>,
) -> Result<(), String> {
    if updates.len() + removals.len() > 256
        || updates.iter().any(|(server_id, env)| {
            !valid_mcp_server_id(server_id)
                || env.len() > 256
                || env.iter().any(|(name, value)| {
                    !valid_env_name(name) || value.is_empty() || value.len() > 16_384
                })
        })
        || removals.iter().any(|(server_id, names)| {
            !valid_mcp_server_id(server_id)
                || names.len() > 256
                || names.iter().any(|name| !valid_env_name(name))
                || names.iter().collect::<BTreeSet<_>>().len() != names.len()
        })
    {
        return Err("Invalid MCP credential changes. Nothing was saved.".into());
    }
    let server_ids = updates
        .keys()
        .chain(removals.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    let mut previous = BTreeMap::new();
    let mut changes = BTreeMap::new();
    let mut total_bytes = 0usize;
    for server_id in &server_ids {
        let before = read(server_id)?.map(Zeroizing::new);
        let mut env = match before.as_deref() {
            Some(serialized) => serde_json::from_str::<BTreeMap<String, String>>(serialized)
                .map_err(|_| "The saved MCP credential record is invalid; nothing was changed.")?,
            None => BTreeMap::new(),
        };
        if env.len() > 256
            || env.iter().any(|(name, value)| !valid_env_name(name) || value.len() > 16_384)
        {
            return Err("The saved MCP credential record is outside supported limits; nothing was changed.".into());
        }
        if let Some(names) = removals.get(server_id) {
            for name in names {
                env.remove(name);
            }
        }
        if let Some(server_updates) = updates.get(server_id) {
            for (name, secret) in server_updates {
                env.insert(name.clone(), secret.to_string());
            }
        }
        let after = if env.is_empty() {
            None
        } else {
            let encoded = Zeroizing::new(
                serde_json::to_string(&env)
                    .map_err(|_| "MCP credentials could not be encoded; nothing was changed")?,
            );
            if encoded.len() > 2_048 {
                return Err("MCP credentials for one server exceed the OS-keychain-safe size limit.".into());
            }
            total_bytes = total_bytes.saturating_add(encoded.len());
            Some(encoded)
        };
        for value in env.values_mut() {
            zeroize::Zeroize::zeroize(value);
        }
        previous.insert(server_id.clone(), before);
        changes.insert(server_id.clone(), after);
    }
    if total_bytes > 64 * 1024 {
        return Err("MCP credentials exceed the total batch size limit.".into());
    }
    let mut attempted = Vec::new();
    for (server_id, secret_record) in &changes {
        attempted.push(server_id.clone());
        if write(
            &format!("mcp_server/{server_id}"),
            secret_record.as_ref().map(|value| value.as_str()),
        )
        .is_err()
        {
            let mut restored = true;
            for changed_server in attempted.into_iter().rev() {
                if write(
                    &format!("mcp_server/{changed_server}"),
                    previous[&changed_server]
                        .as_ref()
                        .map(|value| value.as_str()),
                )
                .is_err()
                {
                    restored = false;
                }
            }
            return Err(if restored {
                "Could not save MCP credentials to the OS keychain. Previous values were restored; preferences were not applied.".into()
            } else {
                "MCP credential save failed and keychain rollback was incomplete. Check the OS credential store before retrying.".into()
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn commit_ai_preferences(
    app: tauri::AppHandle,
    api_keys: BTreeMap<String, String>,
    policy: Option<GuardrailPolicy>,
    mcp_env_secrets: Option<BTreeMap<String, BTreeMap<String, String>>>,
    mcp_env_removals: Option<BTreeMap<String, Vec<String>>>,
) -> Result<BTreeMap<String, bool>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = COMMIT
            .lock()
            .map_err(|_| "AI preferences commit is unavailable")?;
        let secrets = api_keys
            .into_iter()
            .map(|(provider, key)| (provider, Zeroizing::new(key)))
            .collect();
        let (configured, previous_ai_keys) = apply_keys(
            &secrets,
            |provider| {
                let entry =
                    keyring::Entry::new(crate::features::credentials::AI_KEYRING_SERVICE, provider)
                        .map_err(|_| "Could not initialize the AI credential store")?;
                match entry.get_password() {
                    Ok(key) => Ok(Some(key)),
                    Err(keyring::Error::NoEntry) => Ok(None),
                    Err(_) => {
                        Err("Could not read the AI credential store. Nothing was saved.".into())
                    }
                }
            },
            |provider, key| match key {
                Some(key) => crate::features::credentials::store_ai_key_unlogged(provider, key),
                None => crate::features::credentials::delete_ai_key(provider),
            },
        )?;
        let mcp_env_secrets = mcp_env_secrets
            .unwrap_or_default()
            .into_iter()
            .map(|(server_id, env)| {
                (
                    server_id,
                    env.into_iter()
                        .map(|(name, value)| (name, Zeroizing::new(value)))
                        .collect(),
                )
            })
            .collect::<BTreeMap<_, _>>();
        let mcp_env_removals = mcp_env_removals.unwrap_or_default();
        let db = app.state::<crate::core::db::Database>();
        match apply_mcp_env_changes(
            &mcp_env_secrets,
            &mcp_env_removals,
            |server_id| {
                let id = format!("mcp_server/{server_id}");
                let reference = db
                    .get_preference_secret_ref(&id)
                    .map_err(|_| "Could not read the MCP credential mapping")?;
                match reference {
                    Some(reference) => crate::features::credentials::retrieve_preference_secret(
                        &reference,
                    )
                    .map(Some),
                    None => Ok(None),
                }
            },
            |id, secret| {
                if id.strip_prefix("mcp_server/").is_none() {
                    return Err("Invalid MCP server secret identity".into());
                }
                let reference = db
                    .get_preference_secret_ref(id)
                    .map_err(|_| "Could not read the MCP credential mapping")?;
                match (reference, secret) {
                    (Some(reference), Some(secret)) => {
                        crate::features::credentials::store_preference_secret(&reference, secret)
                    }
                    (Some(reference), None) => {
                        crate::features::credentials::delete_preference_secret(&reference)?;
                        db.delete_preference_secret_ref(id)
                            .map_err(|_| "Could not remove the MCP credential mapping")?;
                        Ok(())
                    }
                    (None, Some(secret)) => {
                        let reference = format!("st0_pref_{}", uuid::Uuid::new_v4().simple());
                        crate::features::credentials::store_preference_secret(&reference, secret)?;
                        if db.upsert_preference_secret_ref(id, &reference).is_err() {
                            let _ = crate::features::credentials::delete_preference_secret(&reference);
                            return Err("Could not save the MCP credential mapping".into());
                        }
                        Ok(())
                    }
                    (None, None) => Ok(()),
                }
            },
        ) {
            Ok(_) => {}
            Err(error) => {
                if restore_ai_keys(&previous_ai_keys, |provider, key| match key {
                    Some(key) => crate::features::credentials::store_ai_key_unlogged(provider, key),
                    None => crate::features::credentials::delete_ai_key(provider),
                }).is_err() {
                    return Err("MCP credential save failed and AI-key rollback was incomplete. Check the OS credential store before retrying.".into());
                }
                return Err(error);
            }
        }
        if let Some(policy) = policy {
            app.state::<SandboxManager>()
                .update_guardrail_policy(policy);
        }
        Ok(configured)
    })
    .await
    .map_err(|_| "AI preferences worker stopped unexpectedly".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    #[test]
    fn mcp_runtime_resolver_returns_only_declared_keychain_values_to_native_callers() {
        let public_env = BTreeMap::from([("LOG_LEVEL".to_string(), "debug".to_string())]);
        let resolved = resolve_mcp_env_with_record(
            "server-a",
            &public_env,
            &["GITHUB_TOKEN".to_string()],
            |server_id| {
                assert_eq!(server_id, "server-a");
                Ok(Some(r#"{"GITHUB_TOKEN":"private-token","OTHER_SECRET":"not-requested"}"#.into()))
            },
        )
        .unwrap();
        assert_eq!(resolved["LOG_LEVEL"].as_str(), "debug");
        assert_eq!(resolved["GITHUB_TOKEN"].as_str(), "private-token");
        assert!(!resolved.contains_key("OTHER_SECRET"));
    }

    #[test]
    fn mcp_runtime_resolver_fails_closed_when_a_secret_is_missing() {
        let error = resolve_mcp_env_with_record(
            "server-a",
            &BTreeMap::new(),
            &["GITHUB_TOKEN".to_string()],
            |_| Ok(Some(r#"{"OTHER_SECRET":"private-token"}"#.into())),
        )
        .unwrap_err();
        assert!(error.contains("missing from the OS keychain"));
        assert!(!error.contains("private-token"));
    }

    #[test]
    fn mcp_secret_batch_uses_one_keychain_record_per_server_and_removes_selected_names() {
        let saved = RefCell::new(BTreeMap::from([(
            "server-a".to_string(),
            r#"{"API_TOKEN":"old-secret","LOG_LEVEL":"info"}"#.to_string(),
        )]));
        let updates = BTreeMap::from([
            (
                "server-a".to_string(),
                BTreeMap::from([("API_TOKEN".to_string(), Zeroizing::new("new-secret".to_string()))]),
            ),
            (
                "server-b".to_string(),
                BTreeMap::from([("API_KEY".to_string(), Zeroizing::new("second-secret".to_string()))]),
            ),
        ]);
        let removals = BTreeMap::from([("server-a".to_string(), vec!["LOG_LEVEL".to_string()])]);
        apply_mcp_env_changes(
            &updates,
            &removals,
            |server_id| Ok(saved.borrow().get(server_id).cloned()),
            |id, value| {
                let server_id = id.strip_prefix("mcp_server/").unwrap();
                if let Some(value) = value {
                    saved.borrow_mut().insert(server_id.into(), value.into());
                } else {
                    saved.borrow_mut().remove(server_id);
                }
                Ok(())
            },
        )
        .unwrap();
        let saved = saved.into_inner();
        let server_a: BTreeMap<String, String> = serde_json::from_str(&saved["server-a"]).unwrap();
        let server_b: BTreeMap<String, String> = serde_json::from_str(&saved["server-b"]).unwrap();
        assert_eq!(server_a, BTreeMap::from([("API_TOKEN".into(), "new-secret".into())]));
        assert_eq!(server_b, BTreeMap::from([("API_KEY".into(), "second-secret".into())]));
    }

    #[test]
    fn mcp_secret_batch_rolls_back_all_servers_if_a_keychain_write_fails() {
        let original = BTreeMap::from([
            ("server-a".to_string(), r#"{"TOKEN":"old-a"}"#.to_string()),
            ("server-b".to_string(), r#"{"TOKEN":"old-b"}"#.to_string()),
        ]);
        let saved = RefCell::new(original.clone());
        let failed = RefCell::new(false);
        let updates = BTreeMap::from([
            ("server-a".to_string(), BTreeMap::from([("TOKEN".to_string(), Zeroizing::new("new-a".to_string()))])),
            ("server-b".to_string(), BTreeMap::from([("TOKEN".to_string(), Zeroizing::new("reject-this-secret".to_string()))])),
        ]);
        let error = apply_mcp_env_changes(
            &updates,
            &BTreeMap::new(),
            |server_id| Ok(saved.borrow().get(server_id).cloned()),
            |id, value| {
                let server_id = id.strip_prefix("mcp_server/").unwrap();
                if value.is_some_and(|secret| secret.contains("reject-this-secret")) && !*failed.borrow() {
                    *failed.borrow_mut() = true;
                    return Err("fixture failure".into());
                }
                if let Some(value) = value {
                    saved.borrow_mut().insert(server_id.into(), value.into());
                } else {
                    saved.borrow_mut().remove(server_id);
                }
                Ok(())
            },
        )
        .unwrap_err();
        assert!(error.contains("Previous values were restored"));
        assert!(!error.contains("reject-this-secret"));
        assert_eq!(*saved.borrow(), original);
    }

    #[test]
    fn mcp_secret_batch_rejects_invalid_names_before_keychain_access() {
        let updates = BTreeMap::from([(
            "server-a".to_string(),
            BTreeMap::from([("1BAD_NAME".to_string(), Zeroizing::new("secret".to_string()))]),
        )]);
        let result = apply_mcp_env_changes(
            &updates,
            &BTreeMap::new(),
            |_| panic!("invalid secret changes must be rejected before keychain reads"),
            |_, _| panic!("invalid secret changes must be rejected before keychain writes"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn failed_key_batch_restores_previous_keys_without_returning_or_logging_them() {
        let saved = RefCell::new(BTreeMap::from([(
            "openai".to_string(),
            "previous-secret".to_string(),
        )]));
        let failed = RefCell::new(false);
        let keys = BTreeMap::from([
            ("openai".into(), Zeroizing::new("replacement".into())),
            ("xai_grok".into(), Zeroizing::new("reject".into())),
        ]);
        let result = apply_keys(
            &keys,
            |provider| Ok(saved.borrow().get(provider).cloned()),
            |provider, key| {
                if key == Some("reject") && !*failed.borrow() {
                    *failed.borrow_mut() = true;
                    return Err("test".into());
                }
                if let Some(key) = key {
                    saved.borrow_mut().insert(provider.into(), key.into());
                } else {
                    saved.borrow_mut().remove(provider);
                }
                Ok(())
            },
        );
        assert!(result.unwrap_err().contains("Previous keys were restored"));
        assert_eq!(
            *saved.borrow(),
            BTreeMap::from([("openai".into(), "previous-secret".into())])
        );
    }
    #[test]
    fn reserved_auth_credentials_cannot_be_modified_through_preferences() {
        let keys = BTreeMap::from([(
            "openai_subscription".into(),
            Zeroizing::new("not-an-api-key".into()),
        )]);
        assert!(apply_keys(
            &keys,
            |_| panic!("must not read"),
            |_, _| panic!("must not write")
        )
        .is_err());
    }
}
