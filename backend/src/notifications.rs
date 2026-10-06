use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

pub const NOTIFICATION_EVENT: &str = "app-notification";
const TOAST_EVENT: &str = "stage0-toast";
const ACTION_EVENT: &str = "notification-action";
pub const NOTIFICATION_HOST_LABEL: &str = "notification-host";
const MAX_PENDING_TOASTS: usize = 50;

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
        Self::Info
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NotificationVariant {
    Default,
    Success,
    Warning,
    Danger,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotificationDismissPolicy {
    Manual,
    Timeout,
    #[default]
    Both,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NotificationAction {
    pub label: String,
    #[serde(alias = "action_type")]
    pub action_type: String,
    pub payload: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
    pub id: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub level: NotificationLevel,
    pub variant: Option<NotificationVariant>,
    pub channel: Option<String>,
    pub actions: Option<Vec<NotificationAction>>,
    pub click_action: Option<NotificationAction>,
    #[serde(default)]
    pub dismiss_policy: NotificationDismissPolicy,
    pub auto_dismiss_ms: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct NotificationActionEvent {
    notification_id: Option<String>,
    action: NotificationAction,
}

#[derive(Default)]
struct RuntimeState {
    notification_host_ready: bool,
    pending_toasts: Vec<NotificationPayload>,
    #[cfg(target_os = "linux")]
    active_linux_notification_ids: Vec<u32>,
}

#[derive(Default)]
pub struct NotificationRuntime(Mutex<RuntimeState>);

pub fn ensure_notification_host(app: &AppHandle) {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        if app.get_webview_window(NOTIFICATION_HOST_LABEL).is_some() {
            return;
        }

        let builder = WebviewWindowBuilder::new(
            app,
            NOTIFICATION_HOST_LABEL,
            WebviewUrl::App("index.html".into()),
        )
        .title("Stage0 Notifications")
        .inner_size(400.0, 120.0)
        .min_inner_size(320.0, 80.0)
        .decorations(false)
        .shadow(true)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focusable(false)
        .resizable(false)
        .visible(false);

        if let Err(error) = builder.build() {
            eprintln!("Could not create the Stage0 notification host: {error}");
        }
    }

    #[cfg(target_os = "linux")]
    let _ = app;
}

pub fn close_notification_host_if_unused(app: &AppHandle, destroyed_label: &str) {
    let has_other_user_window = app
        .webview_windows()
        .keys()
        .any(|label| label != NOTIFICATION_HOST_LABEL && label.as_str() != destroyed_label);
    if has_other_user_window {
        return;
    }

    if let Some(runtime) = app.try_state::<NotificationRuntime>() {
        if let Ok(mut state) = runtime.0.lock() {
            state.notification_host_ready = false;
            state.pending_toasts.clear();
        }
    }

    if let Some(host) = app.get_webview_window(NOTIFICATION_HOST_LABEL) {
        let _ = host.destroy();
    }
}

fn has_user_window(app: &AppHandle) -> bool {
    app.webview_windows()
        .keys()
        .any(|label| label != NOTIFICATION_HOST_LABEL)
}

fn queue_or_emit_custom_toast(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    if !has_user_window(app) {
        return Ok(());
    }
    if app.get_webview_window(NOTIFICATION_HOST_LABEL).is_none() {
        ensure_notification_host(app);
    }
    if app.get_webview_window(NOTIFICATION_HOST_LABEL).is_none() {
        return Err("The Stage0 notification host could not be created".to_string());
    }

    let Some(runtime) = app.try_state::<NotificationRuntime>() else {
        return Err("The Stage0 notification runtime is unavailable".to_string());
    };
    let ready = match runtime.0.lock() {
        Ok(mut state) => {
            if state.notification_host_ready {
                true
            } else {
                if state.pending_toasts.len() == MAX_PENDING_TOASTS {
                    state.pending_toasts.remove(0);
                }
                state.pending_toasts.push(payload.clone());
                false
            }
        }
        Err(_) => return Err("The Stage0 notification queue is unavailable".to_string()),
    };

    if ready {
        app.emit_to(NOTIFICATION_HOST_LABEL, TOAST_EVENT, payload)
            .map_err(|error| format!("Could not deliver toast to Stage0: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn notification_host_ready(app: AppHandle, runtime: State<'_, NotificationRuntime>) {
    let pending = match runtime.0.lock() {
        Ok(mut state) => {
            state.notification_host_ready = true;
            std::mem::take(&mut state.pending_toasts)
        }
        Err(_) => Vec::new(),
    };

    if !has_user_window(&app) {
        return;
    }
    for payload in pending {
        let _ = app.emit_to(NOTIFICATION_HOST_LABEL, TOAST_EVENT, payload);
    }
}

#[tauri::command]
pub fn set_notification_host_visibility(app: AppHandle, visible: bool) {
    if !has_user_window(&app) {
        return;
    }
    let Some(host) = app.get_webview_window(NOTIFICATION_HOST_LABEL) else {
        return;
    };
    if visible {
        let _ = host.show();
    } else {
        let _ = host.hide();
    }
}

fn deliver_action_to_user_window(
    app: &AppHandle,
    notification_id: Option<String>,
    action: NotificationAction,
) {
    if !has_user_window(app) {
        return;
    }

    let windows = app.webview_windows();
    let target = windows
        .values()
        .filter(|window| window.label() != NOTIFICATION_HOST_LABEL)
        .find(|window| window.is_focused().unwrap_or(false))
        .cloned()
        .or_else(|| windows.get("main").cloned())
        .or_else(|| {
            windows
                .values()
                .find(|window| window.label() != NOTIFICATION_HOST_LABEL)
                .cloned()
        });

    if let Some(target) = target {
        let _ = target.show();
        let _ = target.set_focus();
        let _ = target.emit(
            ACTION_EVENT,
            NotificationActionEvent {
                notification_id,
                action,
            },
        );
    }
}

#[tauri::command]
pub fn dispatch_notification_action(
    app: AppHandle,
    notification_id: Option<String>,
    action: NotificationAction,
) {
    deliver_action_to_user_window(&app, notification_id, action);
}

pub fn send_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    if !has_user_window(app) {
        return Ok(());
    }

    let _ = app.emit(NOTIFICATION_EVENT, &payload);

    #[cfg(target_os = "linux")]
    {
        send_linux_notification(app, payload)
    }

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        queue_or_emit_custom_toast(app, payload)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = payload;
        Err("Stage0 notifications are not supported on this platform".to_string())
    }
}

#[tauri::command]
pub async fn dispatch_notification(
    app: AppHandle,
    payload: NotificationPayload,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_notification(&app, payload))
        .await
        .map_err(|error| format!("Notification dispatch task failed: {error}"))?
}

/// Sends a visual test notification without emitting the app-notification
/// event used to update persisted history and unread counts.
#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<(), String> {
    let payload = NotificationPayload {
        id: None,
        title: "Stage0 notification preview".to_string(),
        body: "Preview only. Not saved.".to_string(),
        level: NotificationLevel::Info,
        variant: Some(NotificationVariant::Default),
        channel: None,
        actions: None,
        click_action: Some(NotificationAction {
            label: "View notifications".to_string(),
            action_type: "open_preferences".to_string(),
            payload: Some("notifications".to_string()),
        }),
        dismiss_policy: NotificationDismissPolicy::Both,
        auto_dismiss_ms: Some(10_000),
    };

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        queue_or_emit_custom_toast(&app, payload)
    }

    #[cfg(target_os = "linux")]
    {
        send_linux_notification(&app, payload)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = (app, payload);
        Err("Stage0 notifications are not supported on this platform".to_string())
    }
}

#[cfg(target_os = "linux")]
fn send_linux_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    use notify_rust::{Notification, Timeout, Urgency};
    use std::time::Duration;

    let mut notification = Notification::new();
    notification
        .appname("Stage0")
        .summary(&payload.title)
        .body(&payload.body)
        .icon("com.stage0.app");

    let urgency = match payload.variant.as_ref() {
        Some(NotificationVariant::Danger) => Urgency::Critical,
        Some(NotificationVariant::Warning) => Urgency::Normal,
        _ => match &payload.level {
            NotificationLevel::Error => Urgency::Critical,
            _ => Urgency::Normal,
        },
    };
    notification.urgency(urgency);

    if payload.dismiss_policy == NotificationDismissPolicy::Manual {
        notification.timeout(Timeout::Never);
    } else {
        let timeout_ms = payload
            .auto_dismiss_ms
            .unwrap_or(6000)
            .clamp(1000, i32::MAX as u64);
        notification.timeout(Duration::from_millis(timeout_ms));
    }

    if payload.click_action.is_some() {
        notification.action("default", "Open Stage0");
    }
    if let Some(actions) = payload.actions.as_ref() {
        for (index, action) in actions.iter().enumerate() {
            notification.action(&format!("action_{index}"), &action.label);
        }
    }

    let handle = notification
        .show()
        .map_err(|error| format!("Linux notification delivery failed: {error}"))?;
    let notification_id = handle.id();
    if let Some(runtime) = app.try_state::<NotificationRuntime>() {
        if let Ok(mut state) = runtime.0.lock() {
            state.active_linux_notification_ids.push(notification_id);
        }
    }

    let has_actions = payload.click_action.is_some()
        || payload
            .actions
            .as_ref()
            .is_some_and(|actions| !actions.is_empty());
    if has_actions {
        let app_handle = app.clone();
        let payload_id = payload.id.clone();
        let click_action = payload.click_action.clone();
        let actions = payload.actions.clone().unwrap_or_default();
        std::thread::spawn(move || {
            handle.wait_for_action(|response| {
                let action = if response == "default" {
                    click_action.clone()
                } else {
                    response
                        .strip_prefix("action_")
                        .and_then(|index| index.parse::<usize>().ok())
                        .and_then(|index| actions.get(index).cloned())
                };
                if let Some(action) = action {
                    deliver_action_to_user_window(&app_handle, payload_id, action);
                }
            });
        });
    }

    Ok(())
}

#[cfg(target_os = "linux")]
pub fn close_linux_notifications(app: &AppHandle) {
    let Some(runtime) = app.try_state::<NotificationRuntime>() else {
        return;
    };
    let ids = match runtime.0.lock() {
        Ok(mut state) => std::mem::take(&mut state.active_linux_notification_ids),
        Err(_) => Vec::new(),
    };
    if ids.is_empty() {
        return;
    }

    let Ok(connection) = zbus::blocking::Connection::session() else {
        return;
    };
    for id in ids {
        let _ = connection.call_method(
            Some("org.freedesktop.Notifications"),
            "/org/freedesktop/Notifications",
            Some("org.freedesktop.Notifications"),
            "CloseNotification",
            &(id,),
        );
    }
}
