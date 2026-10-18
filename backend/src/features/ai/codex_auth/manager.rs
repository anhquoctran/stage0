use super::{auth_command::AuthCommand, auth_runtime::AuthRuntime, worker, CodexAuthStatus};
use std::{
    path::PathBuf,
    sync::{mpsc, Arc, Condvar, Mutex},
    time::Duration,
};

pub struct CodexAuthManager {
    runtime: Arc<Mutex<AuthRuntime>>,
}

impl Default for CodexAuthManager {
    fn default() -> Self {
        Self {
            runtime: Arc::new(Mutex::new(AuthRuntime {
                status: CodexAuthStatus {
                    phase: "idle".into(),
                    ..Default::default()
                },
                sender: None,
                done: None,
            })),
        }
    }
}
impl CodexAuthManager {
    pub fn status(&self) -> Result<CodexAuthStatus, String> {
        Ok(self
            .runtime
            .lock()
            .map_err(|_| "Codex auth state unavailable")?
            .status
            .clone())
    }
    pub fn begin(&self, profile: PathBuf) -> Result<CodexAuthStatus, String> {
        self.launch(profile, AuthCommand::Login, None)
    }
    pub fn check(&self, profile: PathBuf) -> Result<CodexAuthStatus, String> {
        self.launch(profile, AuthCommand::Check, None)
    }
    pub fn logout(&self, profile: PathBuf, attempt_id: &str) -> Result<CodexAuthStatus, String> {
        self.launch(profile, AuthCommand::Logout, Some(attempt_id))
    }
    fn launch(
        &self,
        profile: PathBuf,
        action: AuthCommand,
        expected: Option<&str>,
    ) -> Result<CodexAuthStatus, String> {
        let mut state = self
            .runtime
            .lock()
            .map_err(|_| "Codex auth state unavailable")?;
        if expected.is_some_and(|id| id != state.status.attempt_id) {
            return Err("ChatGPT authentication state changed; refresh before signing out".into());
        }
        if state.sender.is_some() {
            return Err("A ChatGPT authentication operation is already active. Cancel it or wait for completion.".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let (sender, receiver) = mpsc::channel();
        let done = Arc::new((Mutex::new(false), Condvar::new()));
        state.status = CodexAuthStatus {
            attempt_id: id.clone(),
            phase: match action {
                AuthCommand::Check => "checking",
                AuthCommand::Logout => "signing_out",
                _ => "starting",
            }
            .into(),
            ..Default::default()
        };
        state.sender = Some(sender);
        state.done = Some(done.clone());
        let runtime = Arc::clone(&self.runtime);
        let result = state.status.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                worker::run(&profile, action, &id, &runtime, &receiver)
            }))
            .unwrap_or_else(|_| Err("Codex authentication worker stopped unexpectedly".into()));
            if let Ok(mut state) = runtime.lock() {
                if state.status.attempt_id == id {
                    if state.status.phase == "cancelling" {
                        state.status.phase = "cancelled".into();
                        state.status.account_email = None;
                        state.status.plan_type = None;
                        state.status.error = Some("Device-code sign-in cancelled locally. Authorization may already have completed; sign out the Stage0 Codex profile to remove any saved session.".into());
                    } else if let Err(error) = outcome {
                        state.status.clear_pending();
                        state.status.phase = if error == worker::CANCELLED {
                            "cancelled"
                        } else {
                            "failed"
                        }
                        .into();
                        state.status.error = Some(error);
                    }
                    state.status.clear_pending();
                    state.sender = None;
                    state.done = None;
                }
            }
            let (lock, wake) = &*done;
            if let Ok(mut finished) = lock.lock() {
                *finished = true;
                wake.notify_all();
            }
        });
        Ok(result)
    }
    pub fn cancel(&self, attempt_id: &str) -> Result<CodexAuthStatus, String> {
        let mut state = self
            .runtime
            .lock()
            .map_err(|_| "Codex auth state unavailable")?;
        if state.status.attempt_id != attempt_id
            || !state.status.busy()
            || matches!(state.status.phase.as_str(), "signing_out" | "checking")
        {
            return Err("No matching pending device-code sign-in".into());
        }
        if state.status.phase == "cancelling" {
            return Ok(state.status.clone());
        }
        state
            .sender
            .as_ref()
            .ok_or("No active device-code worker")?
            .send(AuthCommand::Cancel)
            .map_err(|_| "Device-code worker stopped")?;
        state.status.phase = "cancelling".into();
        state.status.clear_pending();
        Ok(state.status.clone())
    }
    pub fn shutdown(&self) {
        let done = if let Ok(state) = self.runtime.lock() {
            if let Some(sender) = &state.sender {
                let _ = sender.send(AuthCommand::Stop);
            }
            state.done.clone()
        } else {
            None
        };
        if let Some(done) = done {
            let (lock, wake) = &*done;
            if let Ok(finished) = lock.lock() {
                let _ = wake.wait_timeout_while(finished, Duration::from_secs(2), |done| !*done);
            }
        }
    }
}
impl Drop for CodexAuthManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn status_checks_and_stale_cancellation_do_not_start_a_process() {
        let manager = super::CodexAuthManager::default();
        assert_eq!(manager.status().unwrap().phase, "idle");
        assert!(manager.cancel("missing").is_err());
        assert!(manager
            .logout(std::env::temp_dir().join("never-created"), "missing")
            .is_err());
        manager.shutdown();
        assert_eq!(manager.status().unwrap().phase, "idle");
    }
}
