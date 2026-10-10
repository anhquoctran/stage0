use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    /// `None` until a second sample has been taken to establish a CPU delta.
    pub cpu_percent: Option<f32>,
    pub memory_bytes: u64,
    pub process_count: u32,
}
