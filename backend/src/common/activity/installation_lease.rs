use super::activity_gate::ActivityGate;
use std::sync::Arc;

/// Atomically refuses active work and prevents new work until dropped.
pub struct InstallationLease {
    gate: Arc<ActivityGate>,
}

impl InstallationLease {
    pub fn acquire() -> Result<Self, String> {
        Self::on(ActivityGate::shared())
    }

    pub(super) fn on(gate: Arc<ActivityGate>) -> Result<Self, String> {
        gate.start_installation()?;
        Ok(Self { gate })
    }
}

impl Drop for InstallationLease {
    fn drop(&mut self) {
        self.gate.finish_installation();
    }
}
