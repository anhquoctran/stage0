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

#[cfg(target_os = "windows")]
fn base64_encode(bytes: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARSET[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARSET[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[cfg(target_os = "windows")]
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "windows")]
pub fn show_windows_native_toast(title: &str, body: &str) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let escaped_title = escape_xml(&title.replace('\n', " "));
    let escaped_body = escape_xml(&body.replace('\n', " "));

    let script = format!(
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;\n\
         [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;\n\
         $xml = '<toast><visual><binding template=\"ToastGeneric\"><text>{escaped_title}</text><text>{escaped_body}</text></binding></visual><audio src=\"ms-winsoundevent:Notification.Default\" /></toast>';\n\
         $doc = [Windows.Data.Xml.Dom.XmlDocument]::new();\n\
         $doc.LoadXml($xml);\n\
         $toast = [Windows.UI.Notifications.ToastNotification]::new($doc);\n\
         $toast.Priority = [Windows.UI.Notifications.ToastNotificationPriority]::High;\n\
         try {{\n\
             $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.stage0.app');\n\
             $notifier.Show($toast);\n\
         }} catch {{\n\
             try {{\n\
                 $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}}\\WindowsPowerShell\\v1.0\\powershell.exe');\n\
                 $notifier.Show($toast);\n\
             }} catch {{}}\n\
         }}"
    );

    let utf16_bytes: Vec<u8> = script.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let encoded = base64_encode(&utf16_bytes);

    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", &encoded])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

/// Core function to dispatch a push notification cross-platform from Rust backend.
/// - Fires native OS notification on Windows (WinRT Toast / PowerShell Toast), macOS (Notification Center), and Linux (Freedesktop D-Bus).
/// - Emits Tauri event `app-notification` to all webviews so listeners stay synchronized.
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
        match app.notification().permission_state() {
            Ok(state) => Ok(matches!(state, tauri_plugin_notification::PermissionState::Granted)),
            Err(err) => {
                eprintln!("[NotificationService] is_notification_permission_granted failed: {err}");
                Ok(false)
            }
        }
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
        match app.notification().request_permission() {
            Ok(state) => Ok(matches!(state, tauri_plugin_notification::PermissionState::Granted)),
            Err(err) => {
                eprintln!("[NotificationService] request_notification_permission failed: {err}");
                Ok(false)
            }
        }
    }
}
