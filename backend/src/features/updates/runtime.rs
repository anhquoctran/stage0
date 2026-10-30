use super::{policy, update_status::UpdateStatus};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::Update;

pub struct UpdateRuntime {
    pub(super) operation: tokio::sync::Mutex<()>,
    pub(super) pending: Mutex<Option<(Update, Option<Vec<u8>>)>>,
    status: Mutex<UpdateStatus>,
}

impl UpdateRuntime {
    pub fn new() -> Self {
        let reason = policy::unsupported_reason();
        Self {
            operation: tokio::sync::Mutex::new(()),
            pending: Mutex::new(None),
            status: Mutex::new(UpdateStatus::initial(reason.is_none(), reason)),
        }
    }

    pub(super) fn snapshot(&self) -> UpdateStatus {
        self.status
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub(super) fn change(
        &self,
        app: &AppHandle,
        change: impl FnOnce(&mut UpdateStatus),
    ) -> UpdateStatus {
        let snapshot = {
            let mut status = self
                .status
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            change(&mut status);
            status.revision += 1;
            status.clone()
        };
        let _ = app.emit("software-update-state", &snapshot);
        snapshot
    }

    pub(super) fn fail(&self, app: &AppHandle, message: &str) {
        self.change(app, |status| {
            status.phase = "error".into();
            status.message = Some(crate::common::messages::command_error(
                "updates",
                message.into(),
            ));
        });
    }

    pub(super) fn require_supported(&self) -> Result<(), String> {
        let status = self.snapshot();
        if !status.supported {
            return Err(status
                .message
                .unwrap_or_else(|| crate::common::messages::code("backend.errors.updates")));
        }
        Ok(())
    }
}
