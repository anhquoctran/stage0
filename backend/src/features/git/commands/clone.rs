use super::clone_credentials::{
    apply_clone_credential_helper, clone_credential_helper_config, prepare_clone_credential,
};
use crate::core::{db::Database, window_manager::resolve_repository};
use crate::features::git::RepoInfo;
use std::path::Path;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn check_remote_repo_url(url: String) -> Result<String, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            crate::features::git::ops::check_git_remote_url(&url)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_clone_remote_refs(
    app: AppHandle,
    url: String,
    credential_id: Option<String>,
) -> Result<crate::features::git::RemoteCloneRefs, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let url = url.trim();
            if url.is_empty() {
                return Err(crate::common::messages::code(
                    "backend.git.cloneUrlRequired",
                ));
            }
            crate::features::git::ops::validate_remote_url(url)?;
            let mut command =
                std::process::Command::new(crate::features::git::runner::get_active_git_path());
            let credential_lease = match credential_id.as_deref() {
                Some(id) => Some(prepare_clone_credential(&app.state::<Database>(), id, url)?),
                None => None,
            };
            if let Some(credential) = credential_lease.as_ref() {
                apply_clone_credential_helper(
                    &mut command,
                    &credential.expected_origin,
                    &clone_credential_helper_config(credential)?,
                );
                command.env_remove("GIT_ASKPASS").env_remove("SSH_ASKPASS");
            } else {
                command.env("GIT_ASKPASS", "echo");
            }
            command
                .env("GIT_TERMINAL_PROMPT", "0")
                .env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh")
                .env("LC_ALL", "C");
            crate::features::git::RemoteCloneRefs::read(&mut command, url)
        })
        .await
        .map_err(|error| format!("Task execution failed: {error}"))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    url: String,
    target_path: String,
    credential_id: Option<String>,
    options: Option<crate::features::git::CloneOptions>,
    on_progress: tauri::ipc::Channel<crate::features::git::progress::GitOperationProgress>,
) -> Result<RepoInfo, String> {
    let result: Result<_, String> = async {
    tauri::async_runtime::spawn_blocking(move || {
        let options = options.unwrap_or_default();
        let clone_args = options.git_arguments()?;
        let trimmed_url = url.trim();
        if trimmed_url.is_empty() {
            return Err(crate::common::messages::code(
                "backend.git.cloneUrlRequired",
            ));
        }
        crate::features::git::ops::validate_remote_url(trimmed_url)?;

        let trimmed_target = target_path.trim();
        if trimmed_target.is_empty() {
            return Err(crate::common::messages::code(
                "backend.git.cloneDestinationRequired",
            ));
        }

        let dest = Path::new(trimmed_target);
        if dest.exists() {
            if let Ok(entries) = std::fs::read_dir(dest) {
                if entries.count() > 0 {
                    return Err(crate::common::messages::code(
                        "backend.git.cloneDestinationNotEmpty",
                    ));
                }
            }
        } else if let Some(parent) = dest.parent() {
            if !parent.exists() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

        let _lease = crate::features::git::GitOperationLease::acquire(trimmed_target)?;
        let reporter = crate::features::git::progress::GitProgressReporter::new(Some(on_progress));
        let git_bin = crate::features::git::runner::get_active_git_path();
        let mut cmd = std::process::Command::new(&git_bin);
        let credential_lease = match credential_id.as_deref() {
            Some(id) => {
                let db = app.state::<Database>();
                Some(prepare_clone_credential(&db, id, trimmed_url)?)
            }
            None => None,
        };
        if let Some(credential) = credential_lease.as_ref() {
            let helper = clone_credential_helper_config(credential)?;
            apply_clone_credential_helper(&mut cmd, &credential.expected_origin, &helper);
            // Do not let the user's askpass program turn a failed one-time
            // credential lookup into an unexpected interactive prompt.
            cmd.env_remove("GIT_ASKPASS").env_remove("SSH_ASKPASS");
        }
        // Disable inherited submodule filters unless the user selects them.
        cmd.args(["-c", "clone.filterSubmodules=false"]);
        cmd.args(clone_args)
            .args(["--", trimmed_url, trimmed_target]);
        if options.skip_lfs {
            cmd.env("GIT_LFS_SKIP_SMUDGE", "1");
        }
        cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        cmd.env("LC_ALL", "C");

        let output = crate::common::process::run_bounded_command_with_progress(
            &mut cmd,
            reporter.observer(),
            4 * 1024 * 1024,
            4 * 1024 * 1024,
            options.timeout(),
        )
        .map_err(|e| format!("Git clone failed: {}", e))?;

        if output.output_truncated {
            return Err(crate::common::messages::code(
                "backend.git.cloneOutputTooLarge",
            ));
        }

        if !output.status.success() {
            let stderr = crate::features::git::runner::redact_sensitive_text(
                &String::from_utf8_lossy(&output.stderr),
            );
            let stdout = crate::features::git::runner::redact_sensitive_text(
                &String::from_utf8_lossy(&output.stdout),
            );
            let err_msg = if !stderr.trim().is_empty() {
                stderr
            } else if !stdout.trim().is_empty() {
                stdout
            } else {
                "Git clone command failed with unknown error".to_string()
            };
            return Err(format!(
                "{}\nThe destination may contain partially cloned data. Inspect it before retrying, or choose a new empty folder.",
                err_msg.trim()
            ));
        }

        if !dest.join(".git").exists() {
            return Err(crate::common::messages::code(
                "backend.git.clonedMetadataMissing",
            ));
        }

        let (canonical_path, _, name) = resolve_repository(trimmed_target)?;
        let db = app.state::<Database>();
        db.upsert_repository("", &name, &canonical_path.to_string_lossy())
            .map_err(|e| format!("Failed to save repository to database: {}", e))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}.await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}
