mod notification_level;
pub use notification_level::NotificationLevel;
mod notification_variant;
pub use notification_variant::NotificationVariant;
mod notification_dismiss_policy;
pub use notification_dismiss_policy::NotificationDismissPolicy;
mod notification_action;
pub use notification_action::NotificationAction;
mod notification_payload;
pub use notification_payload::NotificationPayload;
mod notification_action_event;
use notification_action_event::NotificationActionEvent;
mod permission_state;
pub use permission_state::PermissionState;
mod actions;
mod native;

use tauri::{AppHandle, Emitter, Manager};

pub const NOTIFICATION_EVENT: &str = "app-notification";

mod notification_runtime;
mod runtime_state;
pub use actions::*;
pub use notification_runtime::NotificationRuntime;

pub fn initialize(app: &AppHandle) {
    native::initialize(app);
}

fn channel_enabled(app: &AppHandle, channel: Option<&str>) -> bool {
    let Some(channel) = channel else { return true };
    app.state::<crate::features::preferences::PreferencesManager>()
        .read()
        .ok()
        .and_then(|document| document.settings)
        .and_then(|settings| {
            settings
                .pointer(&format!("/notifications/channels/{channel}"))
                .and_then(serde_json::Value::as_bool)
        })
        .unwrap_or(true)
}

/// Keep history even when OS authorization blocks the native banner. Never prompt here.
pub fn send_notification(app: &AppHandle, mut payload: NotificationPayload) -> Result<(), String> {
    if payload.id.is_none() {
        payload.id = Some(uuid::Uuid::new_v4().to_string());
    }
    if !channel_enabled(app, payload.channel.as_deref()) {
        return Ok(());
    }
    let _ = app.emit(NOTIFICATION_EVENT, &payload);
    native::permission(app, false)?.require_granted()?;
    native::send(app, payload)
}

#[tauri::command]
pub async fn dispatch_notification(
    app: AppHandle,
    payload: NotificationPayload,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_notification(&app, payload))
        .await
        .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?
        .map_err(|error| crate::common::messages::command_error("notifications", error))
}

#[tauri::command]
pub async fn get_notification_permission(app: AppHandle) -> Result<PermissionState, String> {
    tauri::async_runtime::spawn_blocking(move || native::permission(&app, false))
        .await
        .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?
        .map_err(|error| crate::common::messages::command_error("notifications", error))
}

#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Result<PermissionState, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // The blocking worker retains this gate even if the requesting WebView closes.
        let runtime = app.state::<NotificationRuntime>();
        let _guard = runtime.permission_request.lock().map_err(|_| {
            crate::common::messages::code("backend.notifications.runtimeUnavailable")
        })?;
        let permission = native::permission(&app, true)?;
        let _ = app.emit("notification-permission-changed", permission);
        Ok(permission)
    })
    .await
    .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?
    .map_err(|error| crate::common::messages::command_error("notifications", error))
}

#[tauri::command]
pub fn open_notification_settings() -> Result<(), String> {
    native::open_settings()
}

/// A preview uses the native OS surface, without adding an item to app history.
#[tauri::command]
pub async fn send_test_notification(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        native::permission(&app, false)?.require_granted()?;
        let language = app
            .state::<crate::features::preferences::PreferencesManager>()
            .read()
            .ok()
            .and_then(|document| document.settings)
            .and_then(|settings| {
                settings
                    .pointer("/appearance/language")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| "en".into());
        native::send(
            &app,
            NotificationPayload {
                id: Some(uuid::Uuid::new_v4().to_string()),
                title: crate::core::i18n::translate("notifications.testTitle", &language),
                body: crate::core::i18n::translate("notifications.testBody", &language),
                level: NotificationLevel::Info,
                variant: None,
                channel: None,
                actions: None,
                click_action: Some(NotificationAction {
                    label: "Stage0".into(),
                    action_type: "open_preferences".into(),
                    payload: Some("notifications-settings".into()),
                }),
                dismiss_policy: NotificationDismissPolicy::Both,
                auto_dismiss_ms: None,
            },
        )
    })
    .await
    .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?
    .map_err(|error| crate::common::messages::command_error("notifications", error))
}

#[tauri::command]
pub fn dispatch_notification_action(
    app: AppHandle,
    notification_id: Option<String>,
    action: NotificationAction,
) {
    actions::deliver_action_to_user_window(&app, notification_id, action);
}

#[cfg(test)]
mod tests;
