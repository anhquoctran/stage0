//! One native transaction selects immutable credentials and publishes only after commit.
use super::{
    credential_stage, PreferencesManager, PreferencesTransactionRequest,
    PreferencesTransactionResult,
};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) fn commit_transaction(
    app: &AppHandle,
    request: &PreferencesTransactionRequest,
) -> Result<PreferencesTransactionResult, String> {
    credential_stage::validate(request)?;
    super::transaction::run(|| {
        let manager = app.state::<PreferencesManager>();
        let before = manager.read()?;
        if before.validation_error.is_some() {
            return Err("Fix preferences.json before applying changes".into());
        }
        let expected = request
            .expected_revision
            .clone()
            .unwrap_or_else(|| before.revision.clone());
        if expected.is_empty() {
            return Err("A preferences revision is required".into());
        }
        let db = app.state::<crate::core::db::Database>();
        let document = match manager.patch_prepared(request.patch.clone(), expected, |candidate| {
            credential_stage::prepare(&db, candidate, request)
        }) {
            Ok(document) => document,
            Err(error) => {
                // A directory flush can fail after replacement. Do not roll back or
                // delete prepared credentials: either committed snapshot remains valid.
                if let Ok(mut actual) = manager.read() {
                    if actual.revision != before.revision && actual.validation_error.is_none() {
                        actual.publication_sequence = super::transaction::advance_sequence();
                        publish(app, before.settings.as_ref(), &actual);
                        return Err("The on-disk preferences changed; durable transaction completion could not be confirmed. Reload Preferences before retrying.".into());
                    }
                }
                return Err(error);
            }
        };
        publish(app, before.settings.as_ref(), &document);
        Ok(PreferencesTransactionResult {
            document,
            configured: credential_stage::configured(request),
        })
    })
}

pub(super) fn publish(
    app: &AppHandle,
    before: Option<&serde_json::Value>,
    saved: &super::PreferencesDocument,
) {
    if let Some(settings) = &saved.settings {
        super::runtime_config::apply_runtime_preferences(app, settings);
        super::commands::emit_app_language_changed(app, before, Some(settings));
    }
    let _ = app.emit("preferences-changed", saved.revision.clone());
}

#[tauri::command]
pub async fn commit_preferences_transaction(
    app: AppHandle,
    request: PreferencesTransactionRequest,
) -> Result<PreferencesTransactionResult, String> {
    if request
        .expected_revision
        .as_ref()
        .is_none_or(String::is_empty)
    {
        return Err("A preferences revision is required".into());
    }
    tauri::async_runtime::spawn_blocking(move || commit_transaction(&app, &request))
        .await
        .map_err(|_| "Preferences transaction worker stopped unexpectedly".to_string())?
}

/// Startup runs before any review/MCP consumer. Keep active and recovery snapshots;
/// only unreachable prepared objects may be removed. Failures leave retryable garbage.
pub fn recover_prepared_credentials(app: &AppHandle) {
    let manager = app.state::<PreferencesManager>();
    let Ok(document) = manager.read() else {
        return;
    };
    if document.validation_error.is_some() {
        return;
    }
    let recovery = manager.credential_recovery_settings();
    let mut referenced = document
        .settings
        .as_ref()
        .map(credential_stage::referenced)
        .unwrap_or_default();
    referenced.extend(credential_stage::referenced(&recovery));
    let db = app.state::<crate::core::db::Database>();
    let Ok(prepared) = db.staged_preference_secret_refs() else {
        return;
    };
    for (id, reference) in prepared {
        if !referenced.contains(&id)
            && crate::features::credentials::delete_preference_secret(&reference).is_ok()
        {
            let _ = db.delete_preference_secret_ref(&id);
        }
    }
    // Legacy identities can be retired only after both recoverable JSON roots
    // explicitly select versioned values (or removals) for that identity.
    if let Some(current) = document
        .settings
        .as_ref()
        .and_then(|s| s.get("credentialReferences"))
        .and_then(|v| v.as_object())
    {
        for logical in current.keys() {
            if recovery
                .get("credentialReferences")
                .and_then(|r| r.get(logical))
                .is_none()
            {
                continue;
            }
            if let Some(provider) = logical.strip_prefix("ai/") {
                let _ = crate::features::credentials::delete_ai_key(provider);
            } else if logical.starts_with("mcp_server/") {
                if let Ok(Some(reference)) = db.get_preference_secret_ref(logical) {
                    if crate::features::credentials::delete_preference_secret(&reference).is_ok() {
                        let _ = db.delete_preference_secret_ref(logical);
                    }
                }
            }
        }
    }
}
