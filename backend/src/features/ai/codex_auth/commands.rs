use super::{CodexAuthManager, CodexAuthStatus};
use tauri::{AppHandle, Manager};

fn profile(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate Stage0 app storage")?
        .join("codex-auth"))
}

#[tauri::command]
pub fn chatgpt_device_auth_status(app: AppHandle) -> Result<CodexAuthStatus, String> {
    app.state::<CodexAuthManager>().status()
}
#[tauri::command]
pub fn chatgpt_device_auth_start(app: AppHandle) -> Result<CodexAuthStatus, String> {
    app.state::<CodexAuthManager>().begin(profile(&app)?)
}
#[tauri::command]
pub fn chatgpt_device_auth_check(app: AppHandle) -> Result<CodexAuthStatus, String> {
    app.state::<CodexAuthManager>().check(profile(&app)?)
}
#[tauri::command]
pub fn chatgpt_device_auth_cancel(
    app: AppHandle,
    attempt_id: String,
) -> Result<CodexAuthStatus, String> {
    app.state::<CodexAuthManager>().cancel(&attempt_id)
}
#[tauri::command]
pub fn chatgpt_device_auth_logout(
    app: AppHandle,
    attempt_id: String,
) -> Result<CodexAuthStatus, String> {
    app.state::<CodexAuthManager>()
        .logout(profile(&app)?, &attempt_id)
}
