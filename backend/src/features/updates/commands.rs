use super::{download, runtime::UpdateRuntime, update_status::UpdateStatus, workflow};
use tauri::{AppHandle, Manager};

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
