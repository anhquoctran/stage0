use super::PENDING_RELEASE_NOTES_VERSION_SETTING;
use super::{download, runtime::UpdateRuntime, update_status::UpdateStatus, workflow};
use crate::core::db::Database;
use tauri::{AppHandle, Manager, WebviewWindow};

#[tauri::command]
pub fn get_software_update_status(app: AppHandle) -> UpdateStatus {
    app.state::<UpdateRuntime>().snapshot()
}

#[tauri::command]
pub async fn check_software_update(app: AppHandle) -> Result<UpdateStatus, String> {
    workflow::check(&app).await
}

#[tauri::command]
pub async fn download_software_update(app: AppHandle) -> Result<(), String> {
    download::download(&app).await
}

#[tauri::command]
pub async fn install_software_update(
    app: AppHandle,
    saved_work_confirmed: bool,
) -> Result<(), String> {
    workflow::install(&app, saved_work_confirmed).await
}

#[tauri::command]
pub fn consume_software_update_release_notes(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<bool, String> {
    if window.label() != "main" {
        return Ok(false);
    }
    let current_version = app.package_info().version.to_string();
    app.state::<Database>()
        .consume_setting_if_value(PENDING_RELEASE_NOTES_VERSION_SETTING, &current_version)
        .map_err(|_| "Could not load the pending update release notes.".to_string())
}
