use super::state::MrSyncState;
use std::collections::HashMap;

pub(super) struct Subscription {
    pub native: bool,
    pub next_poll: u64,
    pub failures: u32,
    pub retry_after: u64,
    pub focused_at: u64,
    pub sent: HashMap<String, MrSyncState>,
    pub epochs: HashMap<String, i64>,
}
impl Subscription {
    pub fn new(now: u64) -> Self {
        Self {
            native: false,
            next_poll: now,
            failures: 0,
            retry_after: 0,
            focused_at: 0,
            sent: HashMap::new(),
            epochs: HashMap::new(),
        }
    }
    pub fn unwatch(&mut self) {
        self.native = false;
    }
    pub fn needs_watcher(&self) -> bool {
        !self.native
    }
    pub fn schedule(&mut self, now: u64, success: bool, jitter: u64) {
        self.failures = if success {
            0
        } else {
            self.failures.saturating_add(1)
        };
        self.next_poll = now
            + if success {
                if self.native {
                    60_000 + jitter
                } else {
                    30_000 + jitter
                }
            } else {
                (5000u64.saturating_mul(1u64 << self.failures.min(6))).min(300_000)
            };
        self.retry_after = if success { 0 } else { self.next_poll };
    }
}
