use super::NotificationAction;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(super) struct NotificationActionEvent {
    pub(super) notification_id: Option<String>,
    pub(super) action: NotificationAction,
}
