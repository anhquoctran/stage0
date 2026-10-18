use super::{auth_command::AuthCommand, CodexAuthStatus};
use std::sync::{mpsc::Sender, Arc, Condvar, Mutex};

pub struct AuthRuntime {
    pub status: CodexAuthStatus,
    pub sender: Option<Sender<AuthCommand>>,
    pub done: Option<Arc<(Mutex<bool>, Condvar)>>,
}
