use crate::core::db::Database;
use crate::core::window_manager::{
    close_repo_for_window, create_welcome_window, open_repo_path, resolve_repository,
    OpenRepoOutcome, WindowManagerState, WindowStartupContext,
};
use crate::features::git::persistence::{RepoLabelDb, RepoSettingsDb};
use crate::features::git::{
    blame::get_file_blame as calc_file_blame,
    branches::list_branches,
    ops::{
        add_remote, create_branch, create_tag, delete_branch, delete_tag, get_remote_url, git_sync,
        is_rebase_in_progress, list_remotes, list_remotes_detailed, list_tags_detailed,
        remove_remote, rename_branch, set_remote_url, test_remote_connection, GitRemoteDetail,
        GitSyncOptions, GitTagInfo,
    },
    BranchList, ConflictFilePreview, ConflictReport, FileBlamePayload, MrDiffPayload, RepoInfo,
};
use crate::features::sandbox::SandboxManager;
use std::path::Path;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use zeroize::Zeroizing;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoValidation {
    pub is_valid: bool,
    pub exists: bool,
    pub has_git: bool,
    pub has_permission: bool,
    pub error_message: Option<String>,
}

#[tauri::command]
pub async fn open_repo_dialog(
    app: AppHandle,
    window: WebviewWindow,
    force_new_window: Option<bool>,
) -> Result<Option<OpenRepoOutcome>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();

    let folder_path = match folder_opt {
        Some(fp) => fp.to_string(),
        None => return Ok(None),
    };

    open_repo_path(
        &app,
        &folder_path,
        Some(window.label()),
        force_new_window.unwrap_or(false),
    )
    .map(Some)
}

#[tauri::command]
pub async fn open_repo_by_path(
    app: AppHandle,
    window: WebviewWindow,
    repo_path: String,
    force_new_window: Option<bool>,
) -> Result<OpenRepoOutcome, String> {
    open_repo_path(
        &app,
        &repo_path,
        Some(window.label()),
        force_new_window.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn get_window_startup_context(
    window: WebviewWindow,
    manager: tauri::State<'_, WindowManagerState>,
) -> Result<WindowStartupContext, String> {
    Ok(manager.startup_context(window.label()))
}

#[tauri::command]
pub async fn create_new_window(app: AppHandle) -> Result<String, String> {
    create_welcome_window(&app)
}

#[tauri::command]
pub async fn close_repository_window(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    close_repo_for_window(&app, window.label());
    Ok(())
}

#[tauri::command]
pub async fn validate_repo(repo_path: String) -> Result<RepoValidation, String> {
    let path = Path::new(&repo_path);
    if !path.exists() {
        return Ok(RepoValidation {
            is_valid: false,
            exists: false,
            has_git: false,
            has_permission: false,
            error_message: Some("Path does not exist on disk (deleted or moved)".to_string()),
        });
    }

    if !path.is_dir() {
        return Ok(RepoValidation {
            is_valid: false,
            exists: false,
            has_git: false,
            has_permission: false,
            error_message: Some("Path is not a directory".to_string()),
        });
    }

    // Check directory read permission
    if let Err(e) = std::fs::read_dir(path) {
        return Ok(RepoValidation {
            is_valid: false,
            exists: true,
            has_git: false,
            has_permission: false,
            error_message: Some(format!("Permission denied: {}", e)),
        });
    }

    let git_dir = path.join(".git");
    if !git_dir.exists() {
        return Ok(RepoValidation {
            is_valid: false,
            exists: true,
            has_git: false,
            has_permission: true,
            error_message: Some("Directory is not a Git repository (missing .git)".to_string()),
        });
    }

    if git_dir.is_dir() {
        if let Err(e) = std::fs::read_dir(&git_dir) {
            return Ok(RepoValidation {
                is_valid: false,
                exists: true,
                has_git: true,
                has_permission: false,
                error_message: Some(format!("Permission denied reading .git directory: {}", e)),
            });
        }
    } else if git_dir.is_file() {
        if let Err(e) = std::fs::read_to_string(&git_dir) {
            return Ok(RepoValidation {
                is_valid: false,
                exists: true,
                has_git: true,
                has_permission: false,
                error_message: Some(format!("Permission denied reading .git file: {}", e)),
            });
        }
    }

    match list_branches(&repo_path) {
        Ok(_) => Ok(RepoValidation {
            is_valid: true,
            exists: true,
            has_git: true,
            has_permission: true,
            error_message: None,
        }),
        Err(e) => Ok(RepoValidation {
            is_valid: false,
            exists: true,
            has_git: true,
            has_permission: false,
            error_message: Some(format!("Git error: {}", e)),
        }),
    }
}

#[tauri::command]
pub async fn get_recent_repos(app: AppHandle) -> Result<Vec<RepoInfo>, String> {
    let db = app.state::<Database>();
    db.get_recent_repositories()
        .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn delete_recent_repo(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_repository(&id)
        .map_err(|e| format!("Failed to delete repository: {}", e))
}

#[tauri::command]
pub async fn clear_recent_repos(app: AppHandle) -> Result<(), String> {
    let db = app.state::<Database>();
    db.clear_all_repositories()
        .map_err(|e| format!("Failed to clear repositories: {}", e))
}

#[tauri::command]
pub async fn get_branches(repo_path: String) -> Result<BranchList, String> {
    tauri::async_runtime::spawn_blocking(move || list_branches(&repo_path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_mr_diff(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<MrDiffPayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.get_mr_diff(&repo_path, &base, &compare)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn check_merge_conflicts(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<ConflictReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.check_conflicts(&repo_path, &base, &compare)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_conflicted_file_preview(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
    file_path: String,
) -> Result<ConflictFilePreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.get_conflict_preview(&repo_path, &base, &compare, &file_path)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn run_git_sync(
    repo_path: String,
    operation: String,
    options: Option<GitSyncOptions>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || git_sync(&repo_path, &operation, options))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn list_git_remotes(repo_path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || list_remotes(&repo_path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_git_remote_url(
    repo_path: String,
    remote: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || get_remote_url(&repo_path, remote.as_deref()))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn check_rebase_status(repo_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(is_rebase_in_progress(&repo_path)))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_file_blame(
    repo_path: String,
    file_path: String,
    revision: Option<String>,
    ignore_whitespace: Option<bool>,
) -> Result<FileBlamePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        calc_file_blame(
            &repo_path,
            &file_path,
            revision.as_deref(),
            ignore_whitespace,
        )
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn reveal_file_in_os(repo_path: String, file_path: String) -> Result<(), String> {
    let full_path = crate::features::git::resolve_safe_repo_path(&repo_path, &file_path)?;
    #[cfg(target_os = "windows")]
    {
        let win_path = full_path.to_string_lossy().replace('/', "\\");
        let path_obj = std::path::Path::new(&win_path);
        let arg = if path_obj.exists() {
            format!("/select,{}", win_path)
        } else if let Some(parent) = path_obj.parent() {
            parent.to_string_lossy().to_string()
        } else {
            win_path
        };
        std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| format!("Failed to open file explorer: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open in Finder: {}", e))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let target = if full_path.is_file() {
            full_path.parent().unwrap_or(&full_path).to_path_buf()
        } else {
            full_path
        };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn open_repo_in(
    repo_path: String,
    target: String, // "explorer" | "vscode" | "terminal"
) -> Result<(), String> {
    let path = std::path::Path::new(&repo_path);
    if !path.exists() {
        return Err(format!("Repository path does not exist: {}", repo_path));
    }
    let canonical_repo = path
        .canonicalize()
        .map_err(|e| format!("Invalid repository path '{}': {}", repo_path, e))?;

    match target.as_str() {
        "explorer" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = canonical_repo.to_string_lossy().replace('/', "\\");
                std::process::Command::new("explorer")
                    .arg(&win_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open Explorer: {}", e))?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open in Finder: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                std::process::Command::new("xdg-open")
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open file manager: {}", e))?;
                Ok(())
            }
        }
        "vscode" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = canonical_repo.to_string_lossy().replace('/', "\\");
                let mut launched = false;

                let mut candidates = Vec::new();
                if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
                    candidates.push(
                        std::path::PathBuf::from(local_appdata)
                            .join("Programs\\Microsoft VS Code\\Code.exe"),
                    );
                }
                if let Ok(prog_files) = std::env::var("PROGRAMFILES") {
                    candidates.push(
                        std::path::PathBuf::from(prog_files).join("Microsoft VS Code\\Code.exe"),
                    );
                }
                if let Ok(prog_x86) = std::env::var("ProgramFiles(x86)") {
                    candidates.push(
                        std::path::PathBuf::from(prog_x86).join("Microsoft VS Code\\Code.exe"),
                    );
                }

                for cand in candidates {
                    if cand.exists()
                        && std::process::Command::new(&cand)
                            .arg(&win_path)
                            .spawn()
                            .is_ok()
                    {
                        launched = true;
                        break;
                    }
                }

                if !launched
                    && std::process::Command::new("code.exe")
                        .arg(&win_path)
                        .spawn()
                        .is_ok()
                {
                    launched = true;
                }

                if !launched {
                    return Err("Failed to launch Visual Studio Code. Please ensure 'Code.exe' is in your PATH or VS Code is installed.".to_string());
                }
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                let res = std::process::Command::new("code")
                    .arg(&canonical_repo)
                    .spawn();
                if res.is_err() {
                    std::process::Command::new("open")
                        .args(&["-a", "Visual Studio Code"])
                        .arg(&canonical_repo)
                        .spawn()
                        .map_err(|e| format!("Failed to open VS Code: {}", e))?;
                }
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                std::process::Command::new("code")
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open VS Code: {}", e))?;
                Ok(())
            }
        }
        "terminal" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = canonical_repo.to_string_lossy().replace('/', "\\");
                let mut launched = false;

                // 1. Try Windows Terminal directly via wt.exe in LOCALAPPDATA
                if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
                    let wt_path = std::path::PathBuf::from(local_appdata)
                        .join("Microsoft\\WindowsApps\\wt.exe");
                    if wt_path.exists()
                        && std::process::Command::new(&wt_path)
                            .args(["-d", &win_path])
                            .spawn()
                            .is_ok()
                    {
                        launched = true;
                    }
                }

                // 2. Try wt command directly
                if !launched
                    && std::process::Command::new("wt.exe")
                        .args(["-d", &win_path])
                        .spawn()
                        .is_ok()
                {
                    launched = true;
                }

                // 3. Fallback: pass the path through the environment so a
                // directory name cannot become PowerShell source code.
                if !launched {
                    std::process::Command::new("powershell.exe")
                        .args([
                            "-NoExit",
                            "-Command",
                            "Set-Location -LiteralPath $env:STAGE0_REPO_PATH",
                        ])
                        .env("STAGE0_REPO_PATH", &win_path)
                        .spawn()
                        .map_err(|e| format!("Failed to launch terminal: {}", e))?;
                }
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .args(&["-a", "Terminal"])
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                let terminals = [
                    "x-terminal-emulator",
                    "gnome-terminal",
                    "konsole",
                    "xfce4-terminal",
                    "alacritty",
                    "kitty",
                    "xterm",
                ];
                let mut launched = false;
                for term in terminals {
                    if std::process::Command::new(term)
                        .current_dir(&canonical_repo)
                        .spawn()
                        .is_ok()
                    {
                        launched = true;
                        break;
                    }
                }
                if !launched {
                    return Err("No supported terminal emulator found".to_string());
                }
                Ok(())
            }
        }
        _ => Err(format!("Unknown target: {}", target)),
    }
}

#[tauri::command]
pub async fn open_file_in_editor(
    repo_path: String,
    file_path: String,
    line_number: Option<i64>,
) -> Result<(), String> {
    let full_path = crate::features::git::resolve_safe_repo_path(&repo_path, &file_path)?;
    #[cfg(target_os = "windows")]
    {
        let win_path = full_path.to_string_lossy().to_string().replace('/', "\\");
        let target_str = match line_number {
            Some(line) => format!("{}:{}", win_path, line),
            None => win_path,
        };

        let mut launched = false;
        let mut candidates = Vec::new();
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                std::path::PathBuf::from(local_appdata)
                    .join("Programs\\Microsoft VS Code\\Code.exe"),
            );
        }
        if let Ok(prog_files) = std::env::var("PROGRAMFILES") {
            candidates
                .push(std::path::PathBuf::from(prog_files).join("Microsoft VS Code\\Code.exe"));
        }
        if let Ok(prog_x86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(std::path::PathBuf::from(prog_x86).join("Microsoft VS Code\\Code.exe"));
        }

        for cand in candidates {
            if cand.exists()
                && std::process::Command::new(&cand)
                    .arg("-g")
                    .arg(&target_str)
                    .spawn()
                    .is_ok()
            {
                launched = true;
                break;
            }
        }

        if !launched
            && std::process::Command::new("code.exe")
                .arg("-g")
                .arg(&target_str)
                .spawn()
                .is_ok()
        {
            launched = true;
        }

        if !launched {
            return Err(
                "Failed to launch Visual Studio Code. Please ensure 'Code.exe' is in your PATH."
                    .to_string(),
            );
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let base_str = full_path.to_str().unwrap_or(&file_path);
        let target_str = match line_number {
            Some(line) => format!("{}:{}", base_str, line),
            None => base_str.to_string(),
        };

        let res = std::process::Command::new("code")
            .arg("-g")
            .arg(&target_str)
            .spawn();
        if res.is_err() {
            std::process::Command::new("open")
                .args(&["-a", "Visual Studio Code", base_str])
                .spawn()
                .map_err(|e| format!("Failed to open VS Code: {}", e))?;
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let base_str = full_path.to_str().unwrap_or(&file_path);
        let target_str = match line_number {
            Some(line) => format!("{}:{}", base_str, line),
            None => base_str.to_string(),
        };
        std::process::Command::new("code")
            .arg("-g")
            .arg(&target_str)
            .spawn()
            .map_err(|e| format!("Failed to open VS Code: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();
    Ok(folder_opt.map(|fp| fp.to_string()))
}

#[tauri::command]
pub async fn check_remote_repo_url(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::features::git::ops::check_git_remote_url(&url)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    url: String,
    target_path: String,
    credential_id: Option<String>,
) -> Result<RepoInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed_url = url.trim();
        if trimmed_url.is_empty() {
            return Err("Repository URL cannot be empty".to_string());
        }
        crate::features::git::ops::validate_remote_url(trimmed_url)?;

        let trimmed_target = target_path.trim();
        if trimmed_target.is_empty() {
            return Err("Destination path cannot be empty".to_string());
        }

        let dest = Path::new(trimmed_target);
        if dest.exists() {
            if let Ok(entries) = std::fs::read_dir(dest) {
                if entries.count() > 0 {
                    return Err(format!(
                        "Destination directory '{}' already exists and is not empty",
                        trimmed_target
                    ));
                }
            }
        } else if let Some(parent) = dest.parent() {
            if !parent.exists() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

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
            cmd.arg("-c").arg("credential.helper=");
            cmd.arg("-c").arg(format!("credential.helper={helper}"));
            // Do not let the user's askpass program turn a failed one-time
            // credential lookup into an unexpected interactive prompt.
            cmd.env_remove("GIT_ASKPASS").env_remove("SSH_ASKPASS");
        }
        cmd.args(["clone", "--", trimmed_url, trimmed_target]);
        cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");
        cmd.env("GIT_TERMINAL_PROMPT", "0");

        let output = crate::common::process::run_bounded_command(
            &mut cmd,
            4 * 1024 * 1024,
            4 * 1024 * 1024,
            std::time::Duration::from_secs(300),
        )
        .map_err(|e| format!("Git clone failed: {}", e))?;

        if output.output_truncated {
            return Err(
                "Git clone produced more than the configured output limit and was stopped."
                    .to_string(),
            );
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
            return Err(err_msg.trim().to_string());
        }

        if !dest.join(".git").exists() {
            return Err("Cloned directory is missing .git metadata".to_string());
        }

        let (canonical_path, _, name) = resolve_repository(trimmed_target)?;
        let db = app.state::<Database>();
        db.upsert_repository("", &name, &canonical_path.to_string_lossy())
            .map_err(|e| format!("Failed to save repository to database: {}", e))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

struct CloneCredentialLease {
    token_ref: String,
    expected_origin: String,
    username: String,
    delete_secret_on_drop: bool,
}

impl Drop for CloneCredentialLease {
    fn drop(&mut self) {
        if self.delete_secret_on_drop {
            let _ = crate::features::credentials::delete_secret(&self.token_ref);
        }
    }
}

fn prepare_clone_credential(
    db: &Database,
    credential_id: &str,
    remote_url: &str,
) -> Result<CloneCredentialLease, String> {
    let target_origin = crate::features::credentials::https_origin(remote_url)?;
    let credential = db
        .get_git_credential_for_clone(credential_id)
        .map_err(|error| format!("Failed to load Git credentials: {error}"))?
        .ok_or_else(|| {
            "The selected Git credential is no longer available. Refresh the list and try again."
                .to_string()
        })?;

    if credential.token_type == "ssh_key" {
        return Err("SSH key credentials cannot be selected for an HTTPS clone.".to_string());
    }
    let credential_origin = crate::features::credentials::https_origin(&credential.server_url)?;
    if credential_origin != target_origin {
        return Err("The selected Git credential belongs to a different HTTPS host.".to_string());
    }
    if credential.account_name.trim().is_empty()
        || credential
            .account_name
            .bytes()
            .any(|byte| byte == b'\n' || byte == b'\r' || byte == 0)
    {
        return Err("The selected Git credential has an invalid account name.".to_string());
    }

    let (token_ref, delete_secret_on_drop) = match credential.source.as_str() {
        "stage0" => {
            let secret = crate::features::credentials::retrieve_secret(&credential.token_ref)
                .map_err(|_| {
                    "The selected credential is missing from the OS credential store.".to_string()
                })?;
            drop(Zeroizing::new(secret));
            (credential.token_ref, false)
        }
        "system_global" => {
            let secret = crate::features::credentials::retrieve_system_global_credential_for_clone(
                remote_url,
                &credential.account_name,
            )?;
            let token_ref = format!("st0_clone_{}", uuid::Uuid::new_v4().simple());
            crate::features::credentials::store_secret(&token_ref, secret.as_str())?;
            (token_ref, true)
        }
        _ => return Err("The selected Git credential source is unsupported.".to_string()),
    };

    Ok(CloneCredentialLease {
        token_ref,
        expected_origin: target_origin,
        username: credential.account_name,
        delete_secret_on_drop,
    })
}

fn clone_credential_helper_config(credential: &CloneCredentialLease) -> Result<String, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Could not locate the Stage0 executable: {error}"))?
        .to_string_lossy()
        .replace('\\', "/");
    Ok(format!(
        "!{} --stage0-git-credential-helper {} {} {}",
        git_shell_quote(&executable),
        git_shell_quote(&credential.token_ref),
        git_shell_quote(&credential.expected_origin),
        git_shell_quote(&credential.username),
    ))
}

fn git_shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

// ===========================================================================
// Repo Settings & Labels Commands
// ===========================================================================

#[tauri::command]
pub async fn get_repo_settings(
    app: AppHandle,
    repo_id: String,
) -> Result<Option<RepoSettingsDb>, String> {
    let db = app.state::<Database>();
    db.get_repo_settings(&repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_repo_settings(app: AppHandle, settings: RepoSettingsDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.save_repo_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_repo_labels(app: AppHandle, repo_id: String) -> Result<Vec<RepoLabelDb>, String> {
    let db = app.state::<Database>();
    db.list_repo_labels(&repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_repo_label(app: AppHandle, label: RepoLabelDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.create_repo_label(&label).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_repo_label(app: AppHandle, label: RepoLabelDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.update_repo_label(&label).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_repo_label(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_repo_label(&id).map_err(|e| e.to_string())
}

// ===========================================================================
// Git Remotes Detailed & Connectivity Commands
// ===========================================================================

#[tauri::command]
pub async fn list_git_remotes_detailed(repo_path: String) -> Result<Vec<GitRemoteDetail>, String> {
    tauri::async_runtime::spawn_blocking(move || list_remotes_detailed(&repo_path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn add_git_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || add_remote(&repo_path, &name, &url))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn remove_git_remote(repo_path: String, name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || remove_remote(&repo_path, &name))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn set_git_remote_url(
    repo_path: String,
    name: String,
    url: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || set_remote_url(&repo_path, &name, &url))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn test_git_remote(repo_path: String, remote_or_url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || test_remote_connection(&repo_path, &remote_or_url))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

// ===========================================================================
// Git Branches & Tags Commands
// ===========================================================================

#[tauri::command]
pub async fn list_git_tags(repo_path: String) -> Result<Vec<GitTagInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || list_tags_detailed(&repo_path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn create_git_tag(
    repo_path: String,
    tag_name: String,
    commit_ref: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        create_tag(
            &repo_path,
            &tag_name,
            commit_ref.as_deref(),
            message.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn delete_git_tag(repo_path: String, tag_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || delete_tag(&repo_path, &tag_name))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn create_git_branch(
    repo_path: String,
    branch_name: String,
    start_point: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        create_branch(&repo_path, &branch_name, start_point.as_deref())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn delete_git_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || delete_branch(&repo_path, &branch_name, force))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn rename_git_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || rename_branch(&repo_path, &old_name, &new_name))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn scan_git_binaries(
    app: AppHandle,
) -> Result<Vec<crate::features::git::GitBinaryInfo>, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(crate::features::git::scan_system_git_binaries(
            active_path.as_deref(),
            active_id.as_deref(),
        ))
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn get_active_git_binary(
    app: AppHandle,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();
    tauri::async_runtime::spawn_blocking(move || {
        let binaries = crate::features::git::scan_system_git_binaries(
            active_path.as_deref(),
            active_id.as_deref(),
        );

        binaries
            .into_iter()
            .find(|binary| binary.is_active)
            .ok_or_else(|| "No active Git binary detected".to_string())
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn set_active_git_binary(
    app: AppHandle,
    id: String,
    path: String,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::features::git::test_git_version(&path)
            .map_err(|error| format!("Cannot select invalid Git binary: {}", error))?;

        let db = app.state::<Database>();
        db.set_settings_atomic(&[("git_binary_id", &id), ("git_binary_path", &path)])
            .map_err(|error| format!("Failed to persist selected Git binary: {}", error))?;

        crate::features::git::runner::set_active_git_path(Some(path.clone()));

        let name = if id == "system" {
            "System Git (PATH Default)".to_string()
        } else if id == "bundled" {
            "Stage0 Bundled Git".to_string()
        } else {
            format!("Custom Git ({})", path)
        };

        Ok(crate::features::git::GitBinaryInfo {
            id,
            name,
            path,
            version,
            source: "selected".to_string(),
            is_valid: true,
            is_active: true,
        })
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn validate_custom_git_binary(
    path: String,
) -> Result<crate::features::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::features::git::test_git_version(&path)
            .map_err(|error| format!("Failed to validate Git executable: {}", error))?;

        Ok(crate::features::git::GitBinaryInfo {
            id: "custom-candidate".to_string(),
            name: format!("Custom Git ({})", path),
            path,
            version,
            source: "custom".to_string(),
            is_valid: true,
            is_active: false,
        })
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn pick_git_executable(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_opt = app.dialog().file().blocking_pick_file();
    Ok(file_opt.map(|f| f.to_string()))
}
