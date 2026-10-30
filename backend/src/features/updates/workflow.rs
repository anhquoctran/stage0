use super::{
    policy, runtime::UpdateRuntime, transport, update_status::UpdateStatus,
    PENDING_RELEASE_NOTES_VERSION_SETTING,
};
use crate::{
    common::activity::InstallationLease,
    core::db::Database,
    features::{
        preferences::PreferencesManager,
        sandbox::{SandboxManager, SandboxType},
    },
};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

const LAST_CHECK_SETTING: &str = "software_update_last_check";

pub(super) async fn check(app: &AppHandle) -> Result<UpdateStatus, String> {
    let runtime = app.state::<UpdateRuntime>();
    let _operation = runtime
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running")?;
    runtime.require_supported()?;
    if runtime.snapshot().phase == "ready" {
        return Ok(runtime.snapshot());
    }
    *runtime
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = None;
    let checked_at = chrono::Utc::now().to_rfc3339();
    let _ = app
        .state::<Database>()
        .set_setting(LAST_CHECK_SETTING, &checked_at);
    runtime.change(app, |status| {
        status.phase = "checking".into();
        status.version = None;
        status.notes = None;
        status.downloaded_bytes = 0;
        status.total_bytes = None;
        status.message = None;
        status.checked_at = Some(checked_at);
    });
    let result = find_update(app).await;
    match result {
        Ok(update) => {
            let version = update.as_ref().map(|update| update.version.clone());
            let notes = update
                .as_ref()
                .and_then(|update| update.body.as_ref())
                .map(|notes| notes.chars().take(16_000).collect());
            *runtime
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = update.map(|update| (update, None));
            Ok(runtime.change(app, |status| {
                status.phase = if version.is_some() {
                    "available"
                } else {
                    "current"
                }
                .into();
                status.message = version
                    .is_none()
                    .then(|| crate::common::messages::code("backend.updates.current"));
                status.version = version;
                status.notes = notes;
            }))
        }
        Err(error) => {
            runtime.fail(app, &error);
            Err(error)
        }
    }
}

async fn find_update(app: &AppHandle) -> Result<Option<tauri_plugin_updater::Update>, String> {
    let bytes = transport::fetch(
        policy::MANIFEST_URL,
        policy::MANIFEST_LIMIT,
        Duration::from_secs(30),
        |_, _| {},
    )
    .await?
    .ok_or("No update manifest has been published yet. Try again after the first release.")?;
    let manifest = serde_json::from_slice(&bytes).map_err(|_| "The release manifest is invalid")?;
    let updater = app
        .updater_builder()
        .build()
        .map_err(|_| "Could not initialize the software updater")?;
    // restore_update uses normal SemVer comparison and requires a version-bound signature.
    let update = updater
        .restore_update(manifest)
        .map_err(|_| "The release manifest is invalid or has no package for this platform")?
        .map(|update| update.restart_after_install(true));
    if let Some(update) = &update {
        policy::validate_download(&update.download_url, &update.version)?;
    }
    Ok(update)
}

pub(super) async fn install(app: &AppHandle, saved_work_confirmed: bool) -> Result<(), String> {
    if !saved_work_confirmed {
        return Err("Save your work in every Stage0 window and confirm before installing.".into());
    }
    let runtime = app.state::<UpdateRuntime>();
    let _operation = runtime
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running")?;
    runtime.require_supported()?;
    if runtime.snapshot().phase != "ready" {
        return Err("Download and verify an update before installing it.".into());
    }
    // This reservation and operation acquisition use the same atomic gate.
    let installation = InstallationLease::acquire()?;
    // Updater installation can exit Windows directly. Require physical sandboxes
    // to be closed first, rather than bypass their normal resource cleanup.
    if app
        .state::<SandboxManager>()
        .list_active_instances()
        .iter()
        .any(|instance| instance.adapter_type != SandboxType::InMemory)
    {
        return Err("Close Local Worktree and Docker instances in Sandbox settings before installing the update.".into());
    }
    let target_version = runtime
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
        .map(|(update, _)| update.version.clone())
        .ok_or("The verified update is no longer available. Check again.")?;
    app.state::<Database>()
        .set_setting(PENDING_RELEASE_NOTES_VERSION_SETTING, &target_version)
        .map_err(|_| "Could not save the update restart state. Installation was not started.")?;
    let checkpoint = {
        let database = app.state::<Database>();
        let connection = database.conn();
        connection.query_row("PRAGMA wal_checkpoint(FULL);", [], |row| row.get(0))
    };
    let checkpoint_busy: i32 = match checkpoint {
        Ok(busy) => busy,
        Err(_) => {
            let _ = app
                .state::<Database>()
                .delete_settings(&[PENDING_RELEASE_NOTES_VERSION_SETTING]);
            return Err("Could not flush Stage0's database. Installation was not started.".into());
        }
    };
    if checkpoint_busy != 0 {
        let _ = app
            .state::<Database>()
            .delete_settings(&[PENDING_RELEASE_NOTES_VERSION_SETTING]);
        return Err(
            "Stage0's database is busy. Wait for pending writes and retry installation.".into(),
        );
    }
    let pending = runtime
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .take();
    let (update, bytes) = match pending {
        Some((update, Some(bytes))) => (update, bytes),
        Some((update, None)) => {
            *runtime
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = Some((update, None));
            let _ = app
                .state::<Database>()
                .delete_settings(&[PENDING_RELEASE_NOTES_VERSION_SETTING]);
            return Err("Download the update before installing it.".into());
        }
        None => {
            let _ = app
                .state::<Database>()
                .delete_settings(&[PENDING_RELEASE_NOTES_VERSION_SETTING]);
            return Err("The verified update is no longer available. Check again.".into());
        }
    };
    runtime.change(app, |status| {
        status.phase = "installing".into();
        status.message = Some(crate::common::messages::code("backend.updates.installing"));
    });
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _installation = installation;
        // The official installer verifies again immediately before replacement.
        // Windows runs its cleanup hook and exits only after launching the installer.
        if update.install(&bytes).is_err() {
            let _ = handle
                .state::<Database>()
                .delete_settings(&[PENDING_RELEASE_NOTES_VERSION_SETTING]);
            let runtime = handle.state::<UpdateRuntime>();
            *runtime
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = Some((update, Some(bytes)));
            runtime.change(&handle, |status| {
                status.phase = "ready".into();
                status.message = Some(crate::common::messages::code(
                    "backend.updates.installFailed",
                ));
            });
            return Err("Installation failed. The update is still available to retry.".into());
        }
        handle.restart();
    })
    .await
    .map_err(|_| {
        runtime.fail(
            app,
            "The update installer stopped unexpectedly. Restart Stage0 before retrying.",
        );
        "The update installer stopped unexpectedly".to_string()
    })?
}

pub fn start_background_checks(app: &AppHandle) {
    if !app.state::<UpdateRuntime>().snapshot().supported {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(45)).await;
        loop {
            let enabled = app
                .state::<PreferencesManager>()
                .read()
                .ok()
                .filter(|document| document.validation_error.is_none())
                .and_then(|document| document.settings)
                .map(|settings| {
                    settings
                        .pointer("/general/autoCheckUpdates")
                        .and_then(serde_json::Value::as_bool)
                        .unwrap_or(true)
                })
                .unwrap_or(false);
            let status = app.state::<UpdateRuntime>().snapshot();
            let checked_at = status.checked_at.clone().or_else(|| {
                app.state::<Database>()
                    .get_setting(LAST_CHECK_SETTING)
                    .ok()
                    .flatten()
            });
            let due = policy::check_due(checked_at.as_deref(), chrono::Utc::now());
            if enabled && due && matches!(status.phase.as_str(), "idle" | "current" | "error") {
                let _ = check(&app).await;
            }
            tokio::time::sleep(Duration::from_secs(3600)).await;
        }
    });
}
