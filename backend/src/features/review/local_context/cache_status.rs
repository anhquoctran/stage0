use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStatus {
    pub model_ready: bool,
    pub installing: bool,
    pub cache_bytes: u64,
    pub model_bytes: u64,
    pub download_bytes: u64,
}
