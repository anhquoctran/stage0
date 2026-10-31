use super::super::{actions::deliver_action_to_user_window, NotificationPayload, PermissionState};
use tauri::AppHandle;
use tauri_winrt_notification::{Duration, Toast};
use windows::{
    core::HSTRING,
    UI::Notifications::{NotificationSetting, ToastNotificationManager},
};

pub fn permission(app: &AppHandle, _request: bool) -> Result<PermissionState, String> {
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
        &app.config().identifier,
    ));
    match notifier.and_then(|notifier| notifier.Setting()) {
        Ok(setting) if setting == NotificationSetting::Enabled => Ok(PermissionState::Granted),
        Ok(setting) if setting == NotificationSetting::DisabledByManifest => {
            Ok(PermissionState::Unsupported)
        }
        Ok(_) => Ok(PermissionState::Denied),
        Err(_) => Ok(PermissionState::Unsupported),
    }
}

pub fn send(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    let target = app.clone();
    let mut toast = Toast::new(&app.config().identifier)
        .title(&payload.title)
        .text1(&payload.body)
        .duration(Duration::Short);
    if let Some(actions) = payload.actions.as_ref() {
        for (index, action) in actions.iter().take(4).enumerate() {
            toast = toast.add_button(&action.label, &format!("action_{index}"));
        }
    }
    let primary_action = payload.primary_action();
    // The OS owns timeout and placement. A native click restores the target app.
    toast = toast.on_activated(move |arguments| {
        let action = arguments
            .as_deref()
            .and_then(|value| value.strip_prefix("action_"))
            .and_then(|value| value.parse::<usize>().ok())
            .and_then(|index| payload.actions.as_ref()?.get(index).cloned())
            .or_else(|| Some(primary_action.clone()));
        if let Some(action) = action {
            deliver_action_to_user_window(&target, payload.id.clone(), action);
        }
        Ok(())
    });
    toast.show().map_err(|error| {
        crate::common::messages::failure(
            "backend.notifications.dispatchFailed",
            serde_json::json!({}),
            error.to_string(),
        )
    })
}
