use super::runtime_state::RuntimeState;
use super::{NotificationAction, NotificationActionEvent, NotificationRuntime};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
const ACTION_EVENT: &str = "notification-action";

/// Native callbacks may arrive before a cold/reloaded WebView installs listeners.
pub(super) fn deliver_action_to_user_window(
    app: &AppHandle,
    notification_id: Option<String>,
    action: NotificationAction,
) {
    let event = NotificationActionEvent {
        notification_id,
        action,
    };
    let windows = app.webview_windows();
    // Native getters can dispatch to the event loop, whose destroy callbacks also
    // acquire routing state. Never hold that mutex while querying a native window.
    let focused = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .map(|window| window.label().to_owned());
    let runtime = app.state::<NotificationRuntime>();
    let target = {
        let Ok(mut state) = runtime.actions.lock() else {
            return;
        };
        let target = windows
            .values()
            .filter(|window| {
                state.ready.contains(window.label())
                    && RuntimeState::accepts_action(window.label(), &event.action.action_type)
            })
            .find(|window| focused.as_deref() == Some(window.label()))
            .cloned()
            .or_else(|| {
                windows
                    .get("main")
                    .filter(|window| {
                        state.ready.contains(window.label())
                            && RuntimeState::accepts_action(
                                window.label(),
                                &event.action.action_type,
                            )
                    })
                    .cloned()
            })
            .or_else(|| {
                windows
                    .values()
                    .find(|window| {
                        state.ready.contains(window.label())
                            && RuntimeState::accepts_action(
                                window.label(),
                                &event.action.action_type,
                            )
                    })
                    .cloned()
            });
        if target.is_none() {
            state.queue(event.clone());
        }
        target
    };
    if let Some(target) = target {
        let _ = target.show();
        let _ = target.set_focus();
        let _ = target.emit(ACTION_EVENT, event);
    } else if let Some(target) = windows
        .values()
        .find(|window| RuntimeState::accepts_action(window.label(), &event.action.action_type))
    {
        let _ = target.show();
        let _ = target.set_focus();
    } else {
        let _ = crate::core::window_manager::create_welcome_window(app);
    }
}

#[tauri::command]
pub fn set_notification_service_ready(
    window: WebviewWindow,
    ready: bool,
    generation: u64,
) -> Result<(), String> {
    let runtime = window.state::<NotificationRuntime>();
    let pending = {
        let mut state = runtime.actions.lock().map_err(|_| {
            crate::common::messages::code("backend.notifications.runtimeUnavailable")
        })?;
        if !state.set_ready(window.label(), generation, ready) || !ready {
            return Ok(());
        }
        state.take_pending_for(window.label())
    };
    for event in pending {
        let _ = window.emit(ACTION_EVENT, event);
    }
    Ok(())
}

pub fn forget_window(app: &AppHandle, label: &str) {
    let Some(runtime) = app.try_state::<NotificationRuntime>() else {
        return;
    };
    if let Ok(mut state) = runtime.actions.lock() {
        state.ready.remove(label);
        state.generations.remove(label);
    };
}
