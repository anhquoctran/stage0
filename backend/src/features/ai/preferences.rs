use super::keyring_write_progress::KeyringWriteProgress;
use crate::features::sandbox::{guardrails::GuardrailPolicy, manager::SandboxManager};
use std::collections::BTreeMap;
use tauri::Manager;
use zeroize::Zeroizing;

static COMMIT: std::sync::Mutex<()> = std::sync::Mutex::new(());

// Read every old key before writing anything. Never send previous secrets to the WebView.
fn apply_keys(
    keys: &BTreeMap<String, Zeroizing<String>>,
    read: impl Fn(&str) -> Result<Option<String>, String>,
    write: impl Fn(&str, Option<&str>) -> Result<(), String>,
) -> Result<BTreeMap<String, bool>, String> {
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
        return Ok(BTreeMap::new());
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
    Ok(keys
        .keys()
        .map(|provider| (provider.clone(), true))
        .collect())
}

#[tauri::command]
pub async fn commit_ai_preferences(
    app: tauri::AppHandle,
    api_keys: BTreeMap<String, String>,
    policy: Option<GuardrailPolicy>,
) -> Result<BTreeMap<String, bool>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = COMMIT
            .lock()
            .map_err(|_| "AI preferences commit is unavailable")?;
        let secrets = api_keys
            .into_iter()
            .map(|(provider, key)| (provider, Zeroizing::new(key)))
            .collect();
        let configured = apply_keys(
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
