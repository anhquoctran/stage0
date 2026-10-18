use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

#[derive(Default)]
pub struct ReviewCoordinator {
    active: Mutex<HashMap<String, (String, Arc<AtomicBool>)>>,
}

#[cfg(test)]
mod tests {
    #[test]
    fn concurrent_runs_are_bounded_cancelable_and_scoped_to_sessions() {
        let coordinator = super::ReviewCoordinator::default();
        let flag = coordinator.reserve("a", "1").unwrap();
        assert!(coordinator.reserve("a", "2").is_err());
        coordinator.reserve("b", "2").unwrap();
        assert!(coordinator.reserve("c", "3").is_err());
        coordinator.cancel("1").unwrap();
        assert!(flag.load(std::sync::atomic::Ordering::SeqCst));
        coordinator.release("a");
        assert!(coordinator.reserve("c", "3").is_ok());
    }
}

impl ReviewCoordinator {
    pub fn reserve(&self, session: &str, run: &str) -> Result<Arc<AtomicBool>, String> {
        let mut map = self
            .active
            .lock()
            .map_err(|_| "Review coordinator unavailable")?;
        if map.contains_key(session) {
            return Err("A review is already running for this Virtual MR".into());
        }
        if map.len() >= 2 {
            return Err("At most two reviews may run concurrently".into());
        }
        let cancellation = Arc::new(AtomicBool::new(false));
        map.insert(session.into(), (run.into(), Arc::clone(&cancellation)));
        Ok(cancellation)
    }
    pub fn release(&self, session: &str) {
        if let Ok(mut map) = self.active.lock() {
            map.remove(session);
        }
    }
    pub fn cancel(&self, run: &str) -> Result<(), String> {
        let map = self
            .active
            .lock()
            .map_err(|_| "Review coordinator unavailable")?;
        if let Some((_, flag)) = map.values().find(|(id, _)| id == run) {
            flag.store(true, Ordering::SeqCst);
        }
        Ok(())
    }
}
