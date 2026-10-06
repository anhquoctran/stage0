use serde::Serialize;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use sysinfo::{get_current_pid, ProcessRefreshKind, ProcessesToUpdate, System};

const METRICS_REFRESH_INTERVAL: Duration = Duration::from_secs(4);
const CPU_SAMPLE_MAX_AGE: Duration = Duration::from_secs(15);

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    /// `None` until a second sample has been taken to establish a CPU delta.
    pub cpu_percent: Option<f32>,
    pub memory_bytes: u64,
    pub process_count: u32,
}

struct PerformanceSampler {
    system: System,
    root_pid: Option<sysinfo::Pid>,
    last_refresh: Option<Instant>,
    cached_metrics: PerformanceMetrics,
}

impl PerformanceSampler {
    fn new() -> Self {
        Self {
            system: System::new(),
            root_pid: get_current_pid().ok(),
            last_refresh: None,
            cached_metrics: PerformanceMetrics {
                cpu_percent: None,
                memory_bytes: 0,
                process_count: 0,
            },
        }
    }

    fn refresh(&mut self) -> Result<PerformanceMetrics, String> {
        let now = Instant::now();
        if let Some(last_refresh) = self.last_refresh {
            if now.duration_since(last_refresh) < METRICS_REFRESH_INTERVAL {
                return Ok(self.cached_metrics);
            }
        }

        let can_report_cpu = self
            .last_refresh
            .is_some_and(|last_refresh| now.duration_since(last_refresh) <= CPU_SAMPLE_MAX_AGE);
        let Some(root_pid) = self.root_pid else {
            return Err("Could not determine the Stage0 process ID".to_string());
        };

        // Refresh the process table without reading details for every process,
        // then sample only Stage0 and its descendants.
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing(),
        );
        if !self.system.processes().contains_key(&root_pid) {
            return Err("Stage0 process metrics are temporarily unavailable".to_string());
        }

        let mut children_by_parent: HashMap<sysinfo::Pid, Vec<sysinfo::Pid>> = HashMap::new();
        for (pid, process) in self.system.processes() {
            if let Some(parent) = process.parent() {
                children_by_parent.entry(parent).or_default().push(*pid);
            }
        }

        let mut process_ids = Vec::new();
        let mut pending = VecDeque::from([root_pid]);
        let mut seen = HashSet::new();
        while let Some(pid) = pending.pop_front() {
            if !seen.insert(pid) {
                continue;
            }
            process_ids.push(pid);
            if let Some(children) = children_by_parent.get(&pid) {
                pending.extend(children.iter().copied());
            }
        }

        self.system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&process_ids),
            false,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        let mut cpu_percent = 0.0;
        let mut memory_bytes = 0_u64;
        let mut process_count = 0_u32;
        for pid in process_ids {
            if let Some(process) = self.system.process(pid) {
                cpu_percent += process.cpu_usage();
                memory_bytes = memory_bytes.saturating_add(process.memory());
                process_count = process_count.saturating_add(1);
            }
        }

        self.cached_metrics = PerformanceMetrics {
            cpu_percent: can_report_cpu.then_some(cpu_percent),
            memory_bytes,
            process_count,
        };
        self.last_refresh = Some(now);
        Ok(self.cached_metrics)
    }
}

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
