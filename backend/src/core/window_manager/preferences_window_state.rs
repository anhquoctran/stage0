use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

/// Process-wide utility window state; deliberately absent from the repo registry.
#[derive(Default)]
pub struct PreferencesWindowState {
    pub(super) creation: tokio::sync::Mutex<()>,
    pending_tab: Mutex<Option<String>>,
    ready: AtomicBool,
}

impl PreferencesWindowState {
    pub(super) fn request_tab(&self, tab: Option<String>) {
        if let Some(tab) = tab {
            *self.pending_tab.lock().unwrap_or_else(|e| e.into_inner()) = Some(tab);
        }
    }

    pub(super) fn take_tab(&self) -> Option<String> {
        self.pending_tab
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
    }

    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::Acquire)
    }

    pub(super) fn set_ready(&self, ready: bool) {
        self.ready.store(ready, Ordering::Release);
    }

    pub fn destroyed(&self) {
        self.set_ready(false);
        let _ = self.take_tab();
    }
}
