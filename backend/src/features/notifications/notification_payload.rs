use super::{
    NotificationAction, NotificationDismissPolicy, NotificationLevel, NotificationVariant,
};
use serde::{Deserialize, Serialize};

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

impl NotificationPayload {
    pub(super) fn primary_action(&self) -> NotificationAction {
        self.click_action
            .clone()
            .unwrap_or_else(|| NotificationAction {
                label: "Stage0".into(),
                action_type: "show_notifications".into(),
                payload: None,
            })
    }
}
