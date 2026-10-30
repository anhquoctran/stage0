use std::sync::{Arc, Mutex, OnceLock};

#[derive(Default)]
pub(super) struct ActivityGate {
    // The same lock covers checking active work and reserving installation.
    state: Mutex<(usize, bool)>,
}

impl ActivityGate {
    pub(super) fn shared() -> Arc<Self> {
        static GATE: OnceLock<Arc<ActivityGate>> = OnceLock::new();
        Arc::clone(GATE.get_or_init(Default::default))
    }

    pub(super) fn start_operation(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Application activity is unavailable")?;
        if state.1 {
            return Err(crate::common::messages::code(
                "backend.updates.installingRestart",
            ));
        }
        state.0 += 1;
        Ok(())
    }

    pub(super) fn finish_operation(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.0 = state.0.saturating_sub(1);
    }

    pub(super) fn start_installation(&self) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Application activity is unavailable")?;
        if state.1 || state.0 != 0 {
            return Err(crate::common::messages::code(
                "backend.updates.activeOperations",
            ));
        }
        state.1 = true;
        Ok(())
    }

    pub(super) fn finish_installation(&self) {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .1 = false;
    }
}
