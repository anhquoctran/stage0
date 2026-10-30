use crate::core::db::Database;
use crate::features::git::persistence::{RepoLabelDb, RepoSettingsDb};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn get_repo_settings(
    app: AppHandle,
    repo_id: String,
) -> Result<Option<RepoSettingsDb>, String> {
    let db = app.state::<Database>();
    db.get_repo_settings(&repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_repo_settings(app: AppHandle, settings: RepoSettingsDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.save_repo_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_repo_labels(app: AppHandle, repo_id: String) -> Result<Vec<RepoLabelDb>, String> {
    let db = app.state::<Database>();
    db.list_repo_labels(&repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_repo_label(app: AppHandle, label: RepoLabelDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.create_repo_label(&label).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_repo_label(app: AppHandle, label: RepoLabelDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.update_repo_label(&label).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_repo_label(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_repo_label(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_git_binaries(
    app: AppHandle,
) -> Result<Vec<crate::features::git::GitBinaryInfo>, String> {
    let prefs = app
        .state::<crate::features::preferences::PreferencesManager>()
        .read()
        .ok();
    let selected = prefs.and_then(|doc| {
        jsonc_parser::parse_to_serde_value::<serde_json::Value>(&doc.content, &Default::default())
            .ok()
    });
    let active_path = selected
        .as_ref()
        .and_then(|value| value.pointer("/git/binaryPath"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let active_id = selected
        .as_ref()
        .and_then(|value| value.pointer("/git/binaryId"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    tauri::async_runtime::spawn_blocking(move || {
        Ok(crate::features::git::scan_system_git_binaries(
            active_path.as_deref(),
            active_id.as_deref(),
        ))
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn get_active_git_binary(
    app: AppHandle,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    let prefs = app
        .state::<crate::features::preferences::PreferencesManager>()
        .read()
        .ok();
    let selected = prefs.and_then(|doc| {
        jsonc_parser::parse_to_serde_value::<serde_json::Value>(&doc.content, &Default::default())
            .ok()
    });
    let active_path = selected
        .as_ref()
        .and_then(|value| value.pointer("/git/binaryPath"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let active_id = selected
        .as_ref()
        .and_then(|value| value.pointer("/git/binaryId"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    tauri::async_runtime::spawn_blocking(move || {
        let binaries = crate::features::git::scan_system_git_binaries(
            active_path.as_deref(),
            active_id.as_deref(),
        );

        binaries
            .into_iter()
            .find(|binary| binary.is_active)
            .ok_or_else(|| "No active Git binary detected".to_string())
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn set_active_git_binary(
    app: AppHandle,
    id: String,
    path: String,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::features::git::test_git_version(&path)
            .map_err(|error| format!("Cannot select invalid Git binary: {}", error))?;

        crate::features::preferences::transaction::run(|| {
            let preferences = app.state::<crate::features::preferences::PreferencesManager>();
            let current = preferences.read()?;
            let saved = preferences.patch(
                serde_json::json!({ "git": { "binaryId": id, "binaryPath": path } }),
                current.revision,
            )?;
            crate::features::git::runner::set_active_git_path(Some(path.clone()));
            let _ = app.emit("preferences-changed", saved.revision);
            Ok(())
        })?;

        let name = if id == "system" {
            "System Git (PATH Default)".to_string()
        } else if id == "bundled" {
            "Stage0 Bundled Git".to_string()
        } else {
            format!("Custom Git ({})", path)
        };

        Ok(crate::features::git::GitBinaryInfo {
            id,
            name,
            path,
            version,
            source: "selected".to_string(),
            is_valid: true,
            is_active: true,
        })
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn validate_custom_git_binary(
    path: String,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::features::git::test_git_version(&path)
            .map_err(|error| format!("Failed to validate Git executable: {}", error))?;

        Ok(crate::features::git::GitBinaryInfo {
            id: "custom-candidate".to_string(),
            name: format!("Custom Git ({})", path),
            path,
            version,
            source: "custom".to_string(),
            is_valid: true,
            is_active: false,
        })
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn pick_git_executable(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_opt = app.dialog().file().blocking_pick_file();
    Ok(file_opt.map(|f| f.to_string()))
}
