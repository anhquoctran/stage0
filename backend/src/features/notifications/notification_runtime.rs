use super::RuntimeState;
use std::sync::Mutex;

#[derive(Default)]
pub struct NotificationRuntime(pub(super) Mutex<RuntimeState>);
