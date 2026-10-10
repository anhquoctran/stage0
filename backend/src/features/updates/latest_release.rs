use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestRelease {
    pub version: String,
    pub codename: Option<String>,
    pub changelog: Option<String>,
    pub platform: String,
    pub arch: String,
    pub channel: String,
    pub file_name: String,
    pub size_bytes: Option<u64>,
    pub checksum: Option<String>,
    pub has_update: bool,
    // The API may return a short-lived signed URL; keep it entirely in Rust.
    #[serde(skip_serializing)]
    pub download_url: String,
}
