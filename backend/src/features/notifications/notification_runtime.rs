use super::runtime_state::RuntimeState;
use std::sync::Mutex;

#[derive(Default)]
pub struct NotificationRuntime {
    pub(super) permission_request: Mutex<()>,
    pub(super) actions: Mutex<RuntimeState>,
}
