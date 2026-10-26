#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub revision: u64,
    pub phase: String,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub checked_at: Option<String>,
    pub message: Option<String>,
    pub supported: bool,
}

impl UpdateStatus {
    pub(super) fn initial(supported: bool, message: Option<String>) -> Self {
        Self {
            revision: 0,
            phase: if supported { "idle" } else { "unavailable" }.into(),
            current_version: env!("CARGO_PKG_VERSION").into(),
            version: None,
            notes: None,
            downloaded_bytes: 0,
            total_bytes: None,
            checked_at: None,
            message,
            supported,
        }
    }
}
