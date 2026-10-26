use super::activity_gate::ActivityGate;
use std::sync::Arc;

/// Held for the whole operation, including async waits and child cleanup.
pub struct OperationLease {
    gate: Arc<ActivityGate>,
}

impl OperationLease {
    pub fn acquire() -> Result<Self, String> {
        Self::on(ActivityGate::shared())
    }

    pub(super) fn on(gate: Arc<ActivityGate>) -> Result<Self, String> {
        gate.start_operation()?;
        Ok(Self { gate })
    }
}

impl Drop for OperationLease {
    fn drop(&mut self) {
        self.gate.finish_operation();
    }
}
