use super::{
    discover_system_git_credentials, GitCredentialPreferenceRecord, GitCredentialScanCoordinator,
};
use tauri::{AppHandle, Emitter, Manager};

/// Schedules a background refresh and coalesces repeated requests while a scan
/// is running. A later request triggers one more pass with the latest repo list.
pub fn schedule_system_git_credential_rescan(app: &AppHandle) {
    let Some(coordinator) = app.try_state::<GitCredentialScanCoordinator>() else {
        return;
    };
    let start_scan = match coordinator.0.lock() {
        Ok(mut state) if state.running => {
            state.requested_again = true;
            false
        }
        Ok(mut state) => {
            state.running = true;
            true
        }
        Err(poisoned) => {
            let mut state = poisoned.into_inner();
            if state.running {
                state.requested_again = true;
                false
            } else {
                state.running = true;
                true
            }
        }
    };
    if !start_scan {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || loop {
        let scan_result = (|| {
            let db = app.state::<crate::core::db::Database>();
            let repo_paths = db.get_all_repository_paths().ok()?;
            let discovery = discover_system_git_credentials(&repo_paths);
            if discovery.complete {
                db.delete_git_credentials_by_source("system_global").ok()?;
            }
            for credential in &discovery.credentials {
                let record = GitCredentialPreferenceRecord::from(credential);
                db.upsert_git_credential(&record, &credential.token_ref)
                    .ok()?;
            }
            Some(())
        })();
        if scan_result.is_some() {
            let _ = app.emit("git-credentials-updated", ());
        }

        let Some(coordinator) = app.try_state::<GitCredentialScanCoordinator>() else {
            break;
        };
        let run_again = match coordinator.0.lock() {
            Ok(mut state) => {
                if state.requested_again {
                    state.requested_again = false;
                    true
                } else {
                    state.running = false;
                    false
                }
            }
            Err(poisoned) => {
                let mut state = poisoned.into_inner();
                if state.requested_again {
                    state.requested_again = false;
                    true
                } else {
                    state.running = false;
                    false
                }
            }
        };
        if !run_again {
            break;
        }
    });
}
