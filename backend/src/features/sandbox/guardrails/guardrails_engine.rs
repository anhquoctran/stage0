//! Policy state and configuration. Read, command, audit and simulation logic have dedicated modules.
mod audit;
mod command_policy;
mod read_policy;
mod simulation;

use super::{GuardrailAuditEvent, GuardrailMode, GuardrailPolicy};
use std::{collections::VecDeque, sync::Mutex, time::Instant};

pub struct GuardrailsEngine {
    pub(super) policy: Mutex<GuardrailPolicy>,
    pub(super) call_timestamps: Mutex<VecDeque<Instant>>,
    pub(super) audit_log: std::sync::Arc<Mutex<Vec<GuardrailAuditEvent>>>,
}

impl GuardrailsEngine {
    pub fn new() -> Self {
        Self {
            policy: Mutex::new(GuardrailPolicy::balanced()),
            call_timestamps: Mutex::new(VecDeque::new()),
            audit_log: std::sync::Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Create an isolated per-run policy/rate-limit snapshot while keeping
    /// guardrail audit events visible in the app-wide audit log.
    pub fn fork_with_policy_snapshot(&self) -> Self {
        Self {
            policy: Mutex::new(self.get_policy()),
            call_timestamps: Mutex::new(VecDeque::new()),
            audit_log: std::sync::Arc::clone(&self.audit_log),
        }
    }

    pub fn get_policy(&self) -> GuardrailPolicy {
        self.policy
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone()
    }

    pub fn update_policy(&self, new_policy: GuardrailPolicy) {
        const MAX_POLICY_ENTRIES: usize = 256;
        const MAX_POLICY_TEXT_BYTES: usize = 1024;
        let mut new_policy = new_policy;
        new_policy.max_execution_timeout_secs = new_policy.max_execution_timeout_secs.clamp(1, 120);
        new_policy.max_file_read_lines = new_policy.max_file_read_lines.clamp(1, 5000);
        new_policy.max_output_bytes = new_policy.max_output_bytes.clamp(1024, 1024 * 1024);
        new_policy.rate_limit_per_minute = new_policy.rate_limit_per_minute.clamp(1, 120);

        for entries in [
            &mut new_policy.allowed_commands,
            &mut new_policy.blocked_commands,
            &mut new_policy.blocked_patterns,
            &mut new_policy.sensitive_path_patterns,
        ] {
            entries.truncate(MAX_POLICY_ENTRIES);
            for entry in entries.iter_mut() {
                if entry.len() > MAX_POLICY_TEXT_BYTES {
                    let mut boundary = MAX_POLICY_TEXT_BYTES;
                    while !entry.is_char_boundary(boundary) {
                        boundary -= 1;
                    }
                    entry.truncate(boundary);
                }
            }
        }
        let mut policy = self.policy.lock().unwrap_or_else(|p| p.into_inner());
        *policy = new_policy;
    }

    pub fn reset_policy(&self, mode: GuardrailMode) {
        let mut policy = self.policy.lock().unwrap_or_else(|p| p.into_inner());
        *policy = match mode {
            GuardrailMode::Strict => GuardrailPolicy::strict(),
            GuardrailMode::Balanced => GuardrailPolicy::balanced(),
            GuardrailMode::Permissive => GuardrailPolicy::permissive(),
        };
    }
}
