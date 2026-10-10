use super::INSTALL_ACTIVE;
use std::sync::atomic::Ordering;

pub(super) struct InstallActiveGuard(pub(super) bool);

impl InstallActiveGuard {
    pub(super) fn disarm(&mut self) {
        self.0 = false;
    }
}

impl Drop for InstallActiveGuard {
    fn drop(&mut self) {
        if self.0 {
            INSTALL_ACTIVE.store(false, Ordering::Release);
        }
    }
}
