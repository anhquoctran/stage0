use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
#[cfg(not(target_os = "windows"))]
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

#[cfg(target_os = "windows")]
pub fn show_windows_native_toast(title: &str, body: &str) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let escaped_title = title.replace('\'', "''").replace('\n', " ");
    let escaped_body = body.replace('\'', "''").replace('\n', " ");

    let script = format!(
        "$xml = @\"\n\
<toast scenario=\"reminder\">\n\
    <visual>\n\
        <binding template=\"ToastGeneric\">\n\
            <text>{escaped_title}</text>\n\
            <text>{escaped_body}</text>\n\
        </binding>\n\
    </visual>\n\
    <audio src=\"ms-winsoundevent:Notification.Default\" />\n\
</toast>\n\
\"@;\n\
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;\n\
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;\n\
$doc = [Windows.Data.Xml.Dom.XmlDocument]::new();\n\
$doc.LoadXml($xml);\n\
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc);\n\
$toast.Priority = [Windows.UI.Notifications.ToastNotificationPriority]::High;\n\
try {{\n\
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.stage0.app');\n\
    $notifier.Show($toast);\n\
}} catch {{\n\
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}}\\WindowsPowerShell\\v1.0\\powershell.exe');\n\
    $notifier.Show($toast);\n\
}}"
    );

    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

/// Core function to dispatch a push notification cross-platform from Rust backend.
/// - Fires native OS notification on Windows (WinRT Toast), macOS (Notification Center), and Linux (Freedesktop D-Bus).
/// - Emits Tauri event `app-notification` to all webviews so the in-app notification center & toasts stay synchronized.
pub fn send_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    // 1. Emit to in-app frontend listeners
    let _ = app.emit(NOTIFICATION_EVENT, &payload);

    // 2. Dispatch OS native push notification
    #[cfg(target_os = "windows")]
    {
        show_windows_native_toast(&payload.title, &payload.body);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
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
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        app.notification()
            .permission_state()
            .map(|state| matches!(state, tauri_plugin_notification::PermissionState::Granted))
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        app.notification()
            .request_permission()
            .map(|state| matches!(state, tauri_plugin_notification::PermissionState::Granted))
            .map_err(|e| e.to_string())
    }
}
