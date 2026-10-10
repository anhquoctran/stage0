use serde::{Deserialize, Serialize};

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
