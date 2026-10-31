use tauri::{AppHandle, WebviewWindow};

#[tauri::command]
pub async fn open_preferences_window(app: AppHandle, tab: Option<String>) -> Result<(), String> {
    let result: Result<_, String> =
        async { crate::core::window_manager::preferences_window::open(&app, tab).await }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn preferences_window_ready(window: WebviewWindow) -> Result<(), String> {
    let result: Result<_, String> =
        async { crate::core::window_manager::preferences_window::ready(&window).await }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn close_preferences_window(window: WebviewWindow) -> Result<(), String> {
    let result: Result<_, String> = async {
        if window.label() != crate::core::window_manager::preferences_window::LABEL {
            return Err(crate::common::messages::code("backend.preferences.closeUnauthorized"));
        }
        // Cancel/OK already completed the draft lifecycle. Bypass CloseRequested so
        // the native close button and menu cannot recursively reopen the close flow.
        window.destroy().map_err(|error| {
            crate::common::messages::failure(
                "backend.window.destroyFailed",
                serde_json::json!({}),
                error.to_string(),
            )
        })
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}
