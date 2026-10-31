//! Serializes persisted preference updates with their runtime publication.
//!
//! This gate is process-local; the manager also holds its existing file lock
//! and revision check for writers in other processes. The blocking worker owns
//! the gate through publication even when the IPC caller stops awaiting it.
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

static PUBLICATION: Mutex<()> = Mutex::new(());
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(super) fn sequence() -> u64 {
    SEQUENCE.load(Ordering::Acquire)
}
pub(super) fn advance_sequence() -> u64 {
    SEQUENCE.fetch_add(1, Ordering::AcqRel) + 1
}

pub(crate) fn run<T>(operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let _guard = PUBLICATION
        .lock()
        .map_err(|_| crate::common::messages::code("backend.preferences.publicationUnavailable"))?;
    operation()
}

pub(crate) async fn run_async<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || run(operation))
        .await
        .map_err(|_| crate::common::messages::code("backend.preferences.workerStopped"))?
}

#[cfg(test)]
mod tests;
