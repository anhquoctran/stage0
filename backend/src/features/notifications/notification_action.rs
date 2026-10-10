use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NotificationAction {
    pub label: String,
    #[serde(alias = "action_type")]
    pub action_type: String,
    pub payload: Option<String>,
}
