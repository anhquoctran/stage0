mod performance_metrics;
pub use performance_metrics::PerformanceMetrics;
mod performance_sampler;
use performance_sampler::PerformanceSampler;

use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const METRICS_REFRESH_INTERVAL: Duration = Duration::from_secs(4);
const CPU_SAMPLE_MAX_AGE: Duration = Duration::from_secs(15);

static PERFORMANCE_SAMPLER: OnceLock<Mutex<PerformanceSampler>> = OnceLock::new();

#[tauri::command]
pub async fn get_performance_metrics() -> Result<PerformanceMetrics, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let sampler = PERFORMANCE_SAMPLER.get_or_init(|| Mutex::new(PerformanceSampler::new()));
        sampler
            .lock()
            .map_err(|_| "Performance metrics sampler is unavailable".to_string())?
            .refresh()
    })
    .await
    .map_err(|error| format!("Performance metrics task failed: {error}"))?
}
