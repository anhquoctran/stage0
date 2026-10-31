use super::super::{NotificationLevel, NotificationPayload, NotificationVariant, PermissionState};
use tauri::AppHandle;

pub fn permission(_app: &AppHandle, _request: bool) -> Result<PermissionState, String> {
    let available = notify_rust::get_server_information().is_ok();
    Ok(if available {
        PermissionState::SystemManaged
    } else {
        PermissionState::Unsupported
    })
}

pub fn send(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    use notify_rust::{Notification, Timeout, Urgency};
    use std::sync::{Arc, OnceLock};
    static ACTIVE: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    let permit = ACTIVE
        .get_or_init(|| Arc::new(tokio::sync::Semaphore::new(64)))
        .clone()
        .try_acquire_owned()
        .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?;

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

    notification.timeout(Timeout::Default);

    let primary_action = payload.primary_action();
    notification.action("default", &primary_action.label);
    if let Some(actions) = payload.actions.as_ref() {
        for (index, action) in actions.iter().take(4).enumerate() {
            notification.action(&format!("action_{index}"), &action.label);
        }
    }

    let handle = notification.show().map_err(|error| {
        crate::common::messages::failure(
            "backend.notifications.dispatchFailed",
            serde_json::json!({}),
            error.to_string(),
        )
    })?;
    let app_handle = app.clone();
    let payload_id = payload.id.clone();
    let click_action = Some(primary_action);
    let actions = payload.actions.clone().unwrap_or_default();
    std::thread::spawn(move || {
        let _permit = permit;
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
                super::super::actions::deliver_action_to_user_window(
                    &app_handle,
                    payload_id,
                    action,
                );
            }
        });
    });

    Ok(())
}
