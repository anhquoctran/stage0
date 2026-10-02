use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NotificationLevel {
    Info,
    Success,
    Warning,
    Error,
    Update,
}

impl Default for NotificationLevel {
    fn default() -> Self {
        NotificationLevel::Info
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotificationAction {
    pub label: String,
    pub action_type: String,
    pub payload: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotificationPayload {
    pub id: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub level: NotificationLevel,
    pub actions: Option<Vec<NotificationAction>>,
    pub auto_dismiss_ms: Option<u64>,
    pub sound: Option<String>,
}

pub const NOTIFICATION_EVENT: &str = "app-notification";

/// Core function to dispatch a push notification cross-platform from Rust backend.
/// - Fires native OS notification on Windows (WinRT Toast), macOS (Notification Center), and Linux (Freedesktop D-Bus).
/// - Emits Tauri event `app-notification` to all webviews so the in-app notification center & toasts stay synchronized.
pub fn send_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    // 1. Emit to in-app frontend listeners
    let _ = app.emit(NOTIFICATION_EVENT, &payload);

    // 2. Dispatch OS native push notification
    match app.notification().builder()
        .title(&payload.title)
        .body(&payload.body)
        .show()
    {
        Ok(_) => Ok(()),
        Err(err) => {
            eprintln!("[NotificationService] OS Native notification failed: {err}");
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn send_push_notification(
    app: AppHandle,
    payload: NotificationPayload,
) -> Result<(), String> {
    send_notification(&app, payload)
}

#[tauri::command]
pub async fn is_notification_permission_granted(app: AppHandle) -> Result<bool, String> {
    app.notification()
        .permission_state()
        .map(|state| matches!(state, tauri_plugin_notification::PermissionState::Granted))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Result<bool, String> {
    app.notification()
        .request_permission()
        .map(|state| matches!(state, tauri_plugin_notification::PermissionState::Granted))
        .map_err(|e| e.to_string())
}
