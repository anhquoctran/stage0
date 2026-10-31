use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionState {
    Granted,
    SystemManaged,
    Denied,
    Prompt,
    Unsupported,
}

impl PermissionState {
    pub fn require_granted(self) -> Result<(), String> {
        match self {
            Self::Granted | Self::SystemManaged => Ok(()),
            Self::Denied => Err(crate::common::messages::code(
                "backend.notifications.permissionDenied",
            )),
            Self::Prompt => Err(crate::common::messages::code(
                "backend.notifications.permissionRequired",
            )),
            Self::Unsupported => Err(crate::common::messages::code(
                "backend.notifications.unsupportedPlatform",
            )),
        }
    }
}
