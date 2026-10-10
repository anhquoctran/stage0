use super::{DOWNLOAD_ACTIVE, DOWNLOAD_CANCELLED};
use std::sync::atomic::Ordering;

pub(super) struct DownloadActiveGuard;

impl Drop for DownloadActiveGuard {
    fn drop(&mut self) {
        DOWNLOAD_CANCELLED.store(false, Ordering::Release);
        DOWNLOAD_ACTIVE.store(false, Ordering::Release);
    }
}
