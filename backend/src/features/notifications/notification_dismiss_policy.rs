use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotificationDismissPolicy {
    Manual,
    Timeout,
    #[default]
    Both,
}
