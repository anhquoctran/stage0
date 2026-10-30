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
    let result = (|| -> Result<_, String> { app.state::<CodexAuthManager>().status() })();
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}
#[tauri::command]
pub fn chatgpt_device_auth_start(app: AppHandle) -> Result<CodexAuthStatus, String> {
    let result =
        (|| -> Result<_, String> { app.state::<CodexAuthManager>().begin(profile(&app)?) })();
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}
#[tauri::command]
pub fn chatgpt_device_auth_check(app: AppHandle) -> Result<CodexAuthStatus, String> {
    let result =
        (|| -> Result<_, String> { app.state::<CodexAuthManager>().check(profile(&app)?) })();
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}
#[tauri::command]
pub fn chatgpt_device_auth_cancel(
    app: AppHandle,
    attempt_id: String,
) -> Result<CodexAuthStatus, String> {
    let result =
        (|| -> Result<_, String> { app.state::<CodexAuthManager>().cancel(&attempt_id) })();
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}
#[tauri::command]
pub fn chatgpt_device_auth_logout(
    app: AppHandle,
    attempt_id: String,
) -> Result<CodexAuthStatus, String> {
    let result = (|| -> Result<_, String> {
        app.state::<CodexAuthManager>()
            .logout(profile(&app)?, &attempt_id)
    })();
    result.map_err(|error| crate::common::messages::command_error("ai", error))
}
