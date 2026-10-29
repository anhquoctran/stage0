use tauri::{AppHandle, WebviewWindow};

#[tauri::command]
pub async fn open_preferences_window(app: AppHandle, tab: Option<String>) -> Result<(), String> {
    crate::core::window_manager::preferences_window::open(&app, tab).await
}

#[tauri::command]
pub async fn preferences_window_ready(window: WebviewWindow) -> Result<(), String> {
    crate::core::window_manager::preferences_window::ready(&window).await
}

#[tauri::command]
pub async fn close_preferences_window(window: WebviewWindow) -> Result<(), String> {
    if window.label() != crate::core::window_manager::preferences_window::LABEL {
        return Err("Only Preferences can approve its own close request".into());
    }
    // Cancel/OK already completed the draft lifecycle. Bypass CloseRequested so
    // the native close button and menu cannot recursively reopen the close flow.
    window.destroy().map_err(|error| error.to_string())
}
