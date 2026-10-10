use super::NotificationPayload;

#[derive(Default)]
pub(super) struct RuntimeState {
    pub(super) notification_host_ready: bool,
    pub(super) pending_toasts: Vec<NotificationPayload>,
    #[cfg(target_os = "linux")]
    pub(super) active_linux_notification_ids: Vec<u32>,
}
