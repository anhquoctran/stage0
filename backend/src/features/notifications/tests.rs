use super::PermissionState;
use crate::common::messages::PREFIX;

#[test]
fn only_os_granted_authorization_allows_native_delivery() {
    assert!(PermissionState::Granted.require_granted().is_ok());
    assert!(PermissionState::SystemManaged.require_granted().is_ok());
    for (state, code) in [
        (
            PermissionState::Denied,
            "backend.notifications.permissionDenied",
        ),
        (
            PermissionState::Prompt,
            "backend.notifications.permissionRequired",
        ),
        (
            PermissionState::Unsupported,
            "backend.notifications.unsupportedPlatform",
        ),
    ] {
        let wire = state.require_granted().unwrap_err();
        let message: serde_json::Value =
            serde_json::from_str(wire.strip_prefix(PREFIX).unwrap()).unwrap();
        assert_eq!(message["code"], code);
    }
}

#[test]
fn permission_is_serialized_as_a_neutral_state_and_not_a_localized_label() {
    for (state, value) in [
        (PermissionState::Granted, "granted"),
        (PermissionState::Denied, "denied"),
        (PermissionState::SystemManaged, "system_managed"),
        (PermissionState::Prompt, "prompt"),
        (PermissionState::Unsupported, "unsupported"),
    ] {
        assert_eq!(serde_json::to_value(state).unwrap(), value);
    }
}

#[test]
fn stale_subscription_cleanup_cannot_disable_a_newer_ready_webview() {
    let mut state = super::runtime_state::RuntimeState::default();
    assert!(state.set_ready("repo-a", 3, true));
    assert!(!state.set_ready("repo-a", 2, false));
    assert!(state.ready.contains("repo-a"));
    assert!(state.set_ready("repo-b", 1, true));
    assert!(state.set_ready("repo-a", 4, false));
    assert!(!state.ready.contains("repo-a"));
    assert!(state.ready.contains("repo-b"));
}

#[test]
fn pending_native_actions_are_bounded_and_preserve_newest_requests() {
    let mut state = super::runtime_state::RuntimeState::default();
    for id in 0..55 {
        state.queue(super::NotificationActionEvent {
            notification_id: Some(id.to_string()),
            action: super::NotificationAction {
                label: "Stage0".into(),
                action_type: "show_notifications".into(),
                payload: None,
            },
        });
    }
    assert_eq!(state.pending.len(), 50);
    assert_eq!(state.pending[0].notification_id.as_deref(), Some("5"));
    assert_eq!(state.pending[49].notification_id.as_deref(), Some("54"));
}

#[test]
fn preferences_cannot_consume_history_actions_waiting_for_a_workspace() {
    let mut state = super::runtime_state::RuntimeState::default();
    for action_type in ["show_notifications", "open_preferences"] {
        state.queue(super::NotificationActionEvent {
            notification_id: None,
            action: super::NotificationAction {
                label: "Stage0".into(),
                action_type: action_type.into(),
                payload: None,
            },
        });
    }
    let utility = state.take_pending_for("preferences");
    assert_eq!(utility.len(), 1);
    assert_eq!(utility[0].action.action_type, "open_preferences");
    let workspace = state.take_pending_for("repo-a");
    assert_eq!(workspace.len(), 1);
    assert_eq!(workspace[0].action.action_type, "show_notifications");
    assert!(state.pending.is_empty());
}
