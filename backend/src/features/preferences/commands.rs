use super::runtime_config::{apply_runtime_preferences, validate_runtime_preferences};
use super::secrets::reject_git_credentials;
use super::validation::parse_and_validate;
use super::{PreferencesDocument, PreferencesManager};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

const APP_LANGUAGE_CHANGED: &str = "app-language-changed";

fn app_language(settings: Option<&Value>) -> Option<&str> {
    settings?.get("appearance")?.get("language")?.as_str()
}

fn emit_app_language_changed(app: &AppHandle, before: Option<&Value>, after: Option<&Value>) {
    let Some(language) = app_language(after) else {
        return;
    };
    if !super::is_supported_app_language(language) || app_language(before) == Some(language) {
        return;
    }
    let _ = crate::core::menu::set_application_menu_language(app, language);
    crate::core::window_manager::preferences_window::refresh_title(app, language);
    let _ = app.emit(
        APP_LANGUAGE_CHANGED,
        serde_json::json!({ "language": language }),
    );
}

#[tauri::command]
pub async fn initialize_preferences(
    app: AppHandle,
    legacy: Value,
) -> Result<PreferencesDocument, String> {
    super::transaction::run_async(move || {
        let db = app.state::<crate::core::db::Database>();
        let git = match (
            db.get_setting("git_binary_id"),
            db.get_setting("git_binary_path"),
        ) {
            (Ok(Some(id)), Ok(Some(path))) => Some((id, path)),
            _ => None,
        };
        let legacy_credentials = legacy
            .get("gitCredentials")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let manager = app.state::<PreferencesManager>();
        manager.initialize(legacy, git)?;
        migrate_git_credentials_to_sqlite(&app, legacy_credentials)?;
        let document = manager.read()?;
        if let Some(settings) = document.settings.as_ref() {
            apply_runtime_preferences(&app, settings);
            let language = app_language(Some(settings)).unwrap_or(super::DEFAULT_APP_LANGUAGE);
            let _ = crate::core::menu::set_application_menu_language(&app, language);
        }
        db.compact_git_credentials_metadata().map_err(|_| {
            "Legacy Git credential references could not be compacted in SQLite".to_string()
        })?;
        db.delete_settings(&["git_binary_id", "git_binary_path"])
            .map_err(|_| {
                "Legacy Git preference values could not be removed from SQLite".to_string()
            })?;
        crate::features::credentials::schedule_system_git_credential_rescan(&app);
        Ok(document)
    })
    .await
}

#[tauri::command]
pub async fn load_preferences_json(app: AppHandle) -> Result<PreferencesDocument, String> {
    super::transaction::run_async(move || {
        migrate_git_credentials_to_sqlite(&app, Vec::new())?;
        app.state::<PreferencesManager>().read()
    })
    .await
}

fn migrate_git_credentials_to_sqlite(
    app: &AppHandle,
    mut additional_records: Vec<Value>,
) -> Result<(), String> {
    let manager = app.state::<PreferencesManager>();
    let db = app.state::<crate::core::db::Database>();
    let (file_records, revision) = manager.legacy_git_credentials()?;
    let had_file_records = file_records.is_some();
    if let Some(mut file_records) = file_records {
        additional_records.append(&mut file_records);
    }

    for value in additional_records {
        let Ok(record) = serde_json::from_value::<
            crate::features::credentials::GitCredentialPreferenceRecord,
        >(value) else {
            // A malformed legacy record is never copied into the database or exposed by the editor.
            continue;
        };
        db.upsert_git_credential_metadata(&record)
            .map_err(|_| "Git credential metadata could not be migrated to SQLite".to_string())?;
    }

    if had_file_records {
        manager.remove_legacy_git_credentials(revision)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_preferences_json(
    app: AppHandle,
    content: String,
    expected_revision: String,
) -> Result<PreferencesDocument, String> {
    super::transaction::run_async(move || {
        let settings = parse_and_validate(&content)?;
        reject_git_credentials(&settings, "")?;
        validate_runtime_preferences(&settings)?;
        let manager = app.state::<PreferencesManager>();
        let before = manager.read().ok().and_then(|document| document.settings);
        let saved = manager.save(content, expected_revision)?;
        apply_runtime_preferences(&app, &settings);
        let _ = app.emit("preferences-changed", saved.revision.clone());
        emit_app_language_changed(&app, before.as_ref(), Some(&settings));
        Ok(saved)
    })
    .await
}

#[tauri::command]
pub async fn patch_preferences(
    app: AppHandle,
    patch: Value,
    expected_revision: String,
) -> Result<PreferencesDocument, String> {
    super::transaction::run_async(move || {
        let manager = app.state::<PreferencesManager>();
        let before = manager.read().ok().and_then(|document| document.settings);
        let saved = manager.patch(patch, expected_revision)?;
        if let Some(settings) = &saved.settings {
            apply_runtime_preferences(&app, settings);
            emit_app_language_changed(&app, before.as_ref(), Some(settings));
        }
        let _ = app.emit("preferences-changed", saved.revision.clone());
        Ok(saved)
    })
    .await
}

#[tauri::command]
pub async fn reset_preferences_json(app: AppHandle) -> Result<PreferencesDocument, String> {
    super::transaction::run_async(move || {
        let manager = app.state::<PreferencesManager>();
        let before = manager.read().ok().and_then(|document| document.settings);
        let saved = manager.reset()?;
        if let Some(settings) = &saved.settings {
            apply_runtime_preferences(&app, settings);
            emit_app_language_changed(&app, before.as_ref(), Some(settings));
        }
        let _ = app.emit("preferences-changed", saved.revision.clone());
        Ok(saved)
    })
    .await
}
