use super::{NotificationPayload, PermissionState};
use tauri::AppHandle;

#[cfg(target_os = "macos")]
#[path = "native/macos.rs"]
mod platform;
#[cfg(target_os = "windows")]
#[path = "native/windows.rs"]
mod platform;
#[cfg(target_os = "linux")]
#[path = "native/linux.rs"]
mod platform;

pub fn initialize(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    platform::initialize(app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

pub fn permission(app: &AppHandle, request: bool) -> Result<PermissionState, String> {
    platform::permission(app, request)
}

pub fn send(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    platform::send(app, payload)
}

pub fn open_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
        .spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer.exe")
        .arg("ms-settings:notifications")
        .spawn();
    #[cfg(target_os = "linux")]
    let result = {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();
        if desktop.contains("kde") {
            std::process::Command::new("systemsettings")
                .arg("kcm_notifications")
                .spawn()
        } else if desktop.contains("xfce") {
            std::process::Command::new("xfce4-notifyd-config").spawn()
        } else {
            std::process::Command::new("gnome-control-center")
                .arg("notifications")
                .spawn()
        }
    };
    result.map(|_| ()).map_err(|error| {
        crate::common::messages::failure(
            "backend.notifications.settingsFailed",
            serde_json::json!({}),
            error.to_string(),
        )
    })
}
