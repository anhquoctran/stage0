use std::path::Path;
use tauri::{AppHandle, Manager, WebviewWindow, Window};
use tauri_plugin_dialog::DialogExt;
use crate::db::{
    Database, RepoSettingsDb, RepoLabelDb, VirtualMrSessionDb, VirtualMrDiscussionDb, VirtualMrCommentDb,
};
use crate::git::{
    branches::list_branches,
    ops::{
        git_sync, list_remotes, get_remote_url, is_rebase_in_progress, GitSyncOptions,
        list_remotes_detailed, add_remote, remove_remote, set_remote_url, test_remote_connection,
        GitRemoteDetail, list_tags_detailed, create_tag, delete_tag, GitTagInfo,
        create_branch, delete_branch, rename_branch, get_commits_between, get_git_user_identity,
        GitCommitItem,
    },
    blame::get_file_blame as calc_file_blame,
    BranchList, ConflictReport, ConflictFilePreview, MrDiffPayload, RepoInfo, FileBlamePayload,
};
use crate::window_manager::{
    close_repo_for_window, create_welcome_window, open_repo_path, OpenRepoOutcome,
    resolve_repository, WindowManagerState, WindowStartupContext,
};
use crate::sandbox::{
    SandboxAdapterInfo, SandboxExecutionResult, SandboxInstanceInfo, SandboxManager, SandboxType,
};

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
    list_branches(&repo_path)
}

#[tauri::command]
pub async fn get_mr_diff(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<MrDiffPayload, String> {
    let manager = app.state::<SandboxManager>();
    manager.get_mr_diff(&repo_path, &base, &compare)
}

#[tauri::command]
pub async fn check_merge_conflicts(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<ConflictReport, String> {
    let manager = app.state::<SandboxManager>();
    manager.check_conflicts(&repo_path, &base, &compare)
}

#[tauri::command]
pub async fn get_conflicted_file_preview(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
    file_path: String,
) -> Result<ConflictFilePreview, String> {
    let manager = app.state::<SandboxManager>();
    manager.get_conflict_preview(&repo_path, &base, &compare, &file_path)
}

#[tauri::command]
pub async fn run_git_sync(
    repo_path: String,
    operation: String,
    options: Option<GitSyncOptions>,
) -> Result<String, String> {
    git_sync(&repo_path, &operation, options)
}

#[tauri::command]
pub async fn list_git_remotes(
    repo_path: String,
) -> Result<Vec<String>, String> {
    list_remotes(&repo_path)
}

#[tauri::command]
pub async fn get_git_remote_url(
    repo_path: String,
    remote: Option<String>,
) -> Result<String, String> {
    get_remote_url(&repo_path, remote.as_deref())
}

#[tauri::command]
pub async fn check_rebase_status(
    repo_path: String,
) -> Result<bool, String> {
    Ok(is_rebase_in_progress(&repo_path))
}

#[tauri::command]
pub async fn get_file_blame(
    repo_path: String,
    file_path: String,
    revision: Option<String>,
    ignore_whitespace: Option<bool>,
) -> Result<FileBlamePayload, String> {
    calc_file_blame(
        &repo_path,
        &file_path,
        revision.as_deref(),
        ignore_whitespace,
    )
}

#[tauri::command]
pub async fn reveal_file_in_os(
    repo_path: String,
    file_path: String,
) -> Result<(), String> {
    let full_path = std::path::Path::new(&repo_path).join(&file_path);
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

    match target.as_str() {
        "explorer" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = repo_path.replace('/', "\\");
                std::process::Command::new("explorer")
                    .arg(&win_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open Explorer: {}", e))?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg(&repo_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open in Finder: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                std::process::Command::new("xdg-open")
                    .arg(&repo_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open file manager: {}", e))?;
                Ok(())
            }
        }
        "vscode" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = repo_path.replace('/', "\\");
                let res = std::process::Command::new("cmd")
                    .args(&["/c", "code", &win_path])
                    .spawn();

                if res.is_err() {
                    let mut found = false;
                    let local_appdata = std::env::var("LOCALAPPDATA").ok();
                    let prog_files = std::env::var("PROGRAMFILES").ok();

                    let candidates = [
                        local_appdata.as_ref().map(|p| std::path::PathBuf::from(p).join("Programs\\Microsoft VS Code\\Code.exe")),
                        prog_files.as_ref().map(|p| std::path::PathBuf::from(p).join("Microsoft VS Code\\Code.exe")),
                    ];

                    for cand in candidates.into_iter().flatten() {
                        if cand.exists() {
                            if std::process::Command::new(&cand).arg(&win_path).spawn().is_ok() {
                                found = true;
                                break;
                            }
                        }
                    }

                    if !found {
                        return Err("Failed to launch Visual Studio Code. Please ensure 'code' command is in your PATH or VS Code is installed.".to_string());
                    }
                }
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                let res = std::process::Command::new("code")
                    .arg(&repo_path)
                    .spawn();
                if res.is_err() {
                    std::process::Command::new("open")
                        .args(&["-a", "Visual Studio Code", &repo_path])
                        .spawn()
                        .map_err(|e| format!("Failed to open VS Code: {}", e))?;
                }
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                std::process::Command::new("code")
                    .arg(&repo_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open VS Code: {}", e))?;
                Ok(())
            }
        }
        "terminal" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = repo_path.replace('/', "\\");
                let mut launched = false;

                // 1. Try Windows Terminal via wt.exe in LOCALAPPDATA
                if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
                    let wt_path = std::path::PathBuf::from(local_appdata).join("Microsoft\\WindowsApps\\wt.exe");
                    if wt_path.exists() {
                        if std::process::Command::new("cmd")
                            .args(&["/c", "start", "", wt_path.to_str().unwrap(), "-d", &win_path])
                            .spawn()
                            .is_ok()
                        {
                            launched = true;
                        }
                    }
                }

                // 2. Try wt command directly
                if !launched {
                    if std::process::Command::new("cmd")
                        .args(&["/c", "start", "wt", "-d", &win_path])
                        .spawn()
                        .is_ok()
                    {
                        launched = true;
                    }
                }

                // 3. Fallback to PowerShell in the repo directory
                if !launched {
                    std::process::Command::new("cmd")
                        .args(&[
                            "/c",
                            "start",
                            "powershell",
                            "-NoExit",
                            "-Command",
                            &format!("Set-Location -LiteralPath '{}'", win_path.replace('\'', "''")),
                        ])
                        .spawn()
                        .map_err(|e| format!("Failed to launch terminal: {}", e))?;
                }
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .args(&["-a", "Terminal", &repo_path])
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "alacritty", "kitty", "xterm"];
                let mut launched = false;
                for term in terminals {
                    if std::process::Command::new(term)
                        .current_dir(&repo_path)
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
    let full_path = std::path::Path::new(&repo_path).join(&file_path);
    #[cfg(target_os = "windows")]
    {
        let win_path = full_path.to_string_lossy().to_string().replace('/', "\\");
        let target_str = match line_number {
            Some(line) => format!("{}:{}", win_path, line),
            None => win_path,
        };

        let res = std::process::Command::new("cmd")
            .args(&["/c", "code", "-g", &target_str])
            .spawn();

        if res.is_err() {
            let mut found = false;
            let local_appdata = std::env::var("LOCALAPPDATA").ok();
            let prog_files = std::env::var("PROGRAMFILES").ok();

            let candidates = [
                local_appdata.as_ref().map(|p| std::path::PathBuf::from(p).join("Programs\\Microsoft VS Code\\Code.exe")),
                prog_files.as_ref().map(|p| std::path::PathBuf::from(p).join("Microsoft VS Code\\Code.exe")),
            ];

            for cand in candidates.into_iter().flatten() {
                if cand.exists() {
                    if std::process::Command::new(&cand).arg("-g").arg(&target_str).spawn().is_ok() {
                        found = true;
                        break;
                    }
                }
            }

            if !found {
                return Err("Failed to launch Visual Studio Code. Please ensure 'code' command is in your PATH.".to_string());
            }
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
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_is_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_show(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn list_git_credentials(app: AppHandle) -> Result<Vec<crate::credentials::GitCredentialMeta>, String> {
    let db = app.state::<Database>();
    db.get_all_git_credentials()
        .map_err(|e| format!("Failed to load git credentials: {}", e))
}

#[tauri::command]
pub async fn save_git_credential(
    app: AppHandle,
    payload: crate::credentials::SaveGitCredentialPayload,
) -> Result<crate::credentials::GitCredentialMeta, String> {
    if payload.account_name.trim().is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    if payload.secret.trim().is_empty() {
        return Err("Secret / token cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let token_ref = format!("st0_tok_{}", uuid::Uuid::new_v4().simple());

    // 1. Store secret in OS Credential Manager
    crate::credentials::store_secret(&token_ref, payload.secret.trim())?;

    // 2. Store tokenized record in SQLite
    let db = app.state::<Database>();
    if let Err(e) = db.insert_git_credential(
        &id,
        &payload.provider,
        &payload.server_url,
        payload.account_name.trim(),
        &token_ref,
        &payload.token_type,
        payload.label.as_deref(),
    ) {
        // Rollback keyring secret if db fails
        let _ = crate::credentials::delete_secret(&token_ref);
        return Err(format!("Failed to save credential to database: {}", e));
    }

    Ok(crate::credentials::GitCredentialMeta {
        id,
        provider: payload.provider,
        server_url: payload.server_url,
        account_name: payload.account_name,
        token_ref,
        token_type: payload.token_type,
        label: payload.label,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        is_in_keyring: true,
    })
}

#[tauri::command]
pub async fn delete_git_credential(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let token_ref_opt = db
        .delete_git_credential(&id)
        .map_err(|e| format!("Failed to delete credential: {}", e))?;

    if let Some(token_ref) = token_ref_opt {
        let _ = crate::credentials::delete_secret(&token_ref);
    }
    Ok(())
}

#[tauri::command]
pub async fn verify_git_credential(app: AppHandle, id: String) -> Result<bool, String> {
    let db = app.state::<Database>();
    let token_ref_opt = db
        .get_git_credential_token_ref(&id)
        .map_err(|e| format!("Failed to query credential: {}", e))?;

    if let Some(token_ref) = token_ref_opt {
        Ok(crate::credentials::exists_in_keyring(&token_ref))
    } else {
        Err("Credential not found".to_string())
    }
}

#[tauri::command]
pub fn get_keyring_info() -> crate::credentials::OsKeyringInfo {
    crate::credentials::get_os_keyring_info()
}

// ---------------------------------------------------------------------------
// Sandbox Adapter Management Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_available_sandboxes(
    app: AppHandle,
) -> Result<Vec<SandboxAdapterInfo>, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.list_available_adapters())
}

#[tauri::command]
pub async fn get_active_sandbox(
    app: AppHandle,
) -> Result<SandboxType, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_active_type())
}

#[tauri::command]
pub async fn set_active_sandbox(
    app: AppHandle,
    adapter_type: SandboxType,
) -> Result<SandboxType, String> {
    let manager = app.state::<SandboxManager>();
    manager.set_active_type(adapter_type.clone());
    Ok(adapter_type)
}

#[tauri::command]
pub async fn create_sandbox_instance(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<SandboxInstanceInfo, String> {
    let manager = app.state::<SandboxManager>();
    manager.create_instance(&repo_path, &base, &compare)
}

#[tauri::command]
pub async fn destroy_sandbox_instance(
    app: AppHandle,
    instance_id: String,
) -> Result<(), String> {
    let manager = app.state::<SandboxManager>();
    manager.destroy_instance(&instance_id)
}

#[tauri::command]
pub async fn list_sandbox_instances(
    app: AppHandle,
) -> Result<Vec<SandboxInstanceInfo>, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.list_active_instances())
}

#[tauri::command]
pub async fn execute_sandbox_command(
    app: AppHandle,
    instance_id: String,
    command: String,
    args: Vec<String>,
) -> Result<SandboxExecutionResult, String> {
    let manager = app.state::<SandboxManager>();
    manager.execute_command(&instance_id, &command, &args)
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();
    Ok(folder_opt.map(|fp| fp.to_string()))
}

#[tauri::command]
pub async fn check_remote_repo_url(url: String) -> Result<String, String> {
    crate::git::ops::check_git_remote_url(&url)
}

#[tauri::command]
pub async fn clone_repository(
    app: AppHandle,
    url: String,
    target_path: String,
) -> Result<RepoInfo, String> {
    let trimmed_url = url.trim();
    if trimmed_url.is_empty() {
        return Err("Repository URL cannot be empty".to_string());
    }

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

    let mut cmd = std::process::Command::new("git");
    cmd.args(&["clone", trimmed_url, trimmed_target]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
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
}

// ===========================================================================
// Repo Settings & Labels Commands
// ===========================================================================

#[tauri::command]
pub async fn get_repo_settings(app: AppHandle, repo_id: String) -> Result<Option<RepoSettingsDb>, String> {
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
    list_remotes_detailed(&repo_path)
}

#[tauri::command]
pub async fn add_git_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
    add_remote(&repo_path, &name, &url)
}

#[tauri::command]
pub async fn remove_git_remote(repo_path: String, name: String) -> Result<(), String> {
    remove_remote(&repo_path, &name)
}

#[tauri::command]
pub async fn set_git_remote_url(repo_path: String, name: String, url: String) -> Result<(), String> {
    set_remote_url(&repo_path, &name, &url)
}

#[tauri::command]
pub async fn test_git_remote(repo_path: String, remote_or_url: String) -> Result<String, String> {
    test_remote_connection(&repo_path, &remote_or_url)
}

// ===========================================================================
// Git Branches & Tags Commands
// ===========================================================================

#[tauri::command]
pub async fn list_git_tags(repo_path: String) -> Result<Vec<GitTagInfo>, String> {
    list_tags_detailed(&repo_path)
}

#[tauri::command]
pub async fn create_git_tag(
    repo_path: String,
    tag_name: String,
    commit_ref: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    create_tag(&repo_path, &tag_name, commit_ref.as_deref(), message.as_deref())
}

#[tauri::command]
pub async fn delete_git_tag(repo_path: String, tag_name: String) -> Result<(), String> {
    delete_tag(&repo_path, &tag_name)
}

#[tauri::command]
pub async fn create_git_branch(
    repo_path: String,
    branch_name: String,
    start_point: Option<String>,
) -> Result<(), String> {
    create_branch(&repo_path, &branch_name, start_point.as_deref())
}

#[tauri::command]
pub async fn delete_git_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<(), String> {
    delete_branch(&repo_path, &branch_name, force)
}

#[tauri::command]
pub async fn rename_git_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    rename_branch(&repo_path, &old_name, &new_name)
}

// ===========================================================================
// Virtual MR Sessions, Commits & Identity Commands
// ===========================================================================

#[tauri::command]
pub async fn list_virtual_mr_sessions(app: AppHandle, repo_id: String) -> Result<Vec<VirtualMrSessionDb>, String> {
    let db = app.state::<Database>();
    db.list_virtual_mr_sessions(&repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_virtual_mr_session(app: AppHandle, session: VirtualMrSessionDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.save_virtual_mr_session(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_virtual_mr_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_virtual_mr_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_commits_between_refs(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<Vec<GitCommitItem>, String> {
    get_commits_between(&repo_path, &base, &compare)
}

#[tauri::command]
pub async fn get_git_user_identity_cmd(repo_path: String) -> Result<(String, String), String> {
    get_git_user_identity(&repo_path)
}

// ===========================================================================
// Discussions & Comments Commands
// ===========================================================================

#[tauri::command]
pub async fn list_mr_discussions(app: AppHandle, session_id: String) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    let db = app.state::<Database>();
    db.list_discussions(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_mr_discussion(
    app: AppHandle,
    discussion: VirtualMrDiscussionDb,
    first_comment: VirtualMrCommentDb,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.create_discussion(&discussion, &first_comment).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_mr_comment(app: AppHandle, comment: VirtualMrCommentDb) -> Result<(), String> {
    let db = app.state::<Database>();
    db.add_comment(&comment).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resolve_mr_discussion(
    app: AppHandle,
    discussion_id: String,
    is_resolved: bool,
    resolve_type: String,
    resolved_by: Option<String>,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.resolve_discussion(&discussion_id, is_resolved, &resolve_type, resolved_by.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_mr_discussion(
    app: AppHandle,
    discussion_id: String,
    verification_status: String,
    verified_by_bot: String,
    pass: bool,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.verify_discussion(&discussion_id, &verification_status, &verified_by_bot, pass)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_git_binaries(
    app: AppHandle,
) -> Result<Vec<crate::git::GitBinaryInfo>, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();

    let binaries = crate::git::scan_system_git_binaries(
        active_path.as_deref(),
        active_id.as_deref(),
    );
    Ok(binaries)
}

#[tauri::command]
pub async fn get_active_git_binary(
    app: AppHandle,
) -> Result<crate::git::GitBinaryInfo, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();

    let binaries = crate::git::scan_system_git_binaries(
        active_path.as_deref(),
        active_id.as_deref(),
    );

    if let Some(active) = binaries.into_iter().find(|b| b.is_active) {
        Ok(active)
    } else {
        Err("No active Git binary detected".to_string())
    }
}

#[tauri::command]
pub async fn set_active_git_binary(
    app: AppHandle,
    id: String,
    path: String,
) -> Result<crate::git::GitBinaryInfo, String> {
    let version = crate::git::test_git_version(&path)
        .map_err(|e| format!("Cannot select invalid Git binary at '{}': {}", path, e))?;

    let db = app.state::<Database>();
    let _ = db.set_setting("git_binary_id", &id);
    let _ = db.set_setting("git_binary_path", &path);

    crate::git::runner::set_active_git_path(Some(path.clone()));

    let name = if id == "system" {
        "System Git (PATH Default)".to_string()
    } else if id == "bundled" {
        "Stage0 Bundled Git".to_string()
    } else {
        format!("Custom Git ({})", path)
    };

    Ok(crate::git::GitBinaryInfo {
        id,
        name,
        path,
        version,
        source: "selected".to_string(),
        is_valid: true,
        is_active: true,
    })
}

#[tauri::command]
pub async fn validate_custom_git_binary(
    path: String,
) -> Result<crate::git::GitBinaryInfo, String> {
    let version = crate::git::test_git_version(&path)
        .map_err(|e| format!("Failed to validate Git executable: {}", e))?;

    Ok(crate::git::GitBinaryInfo {
        id: "custom-candidate".to_string(),
        name: format!("Custom Git ({})", path),
        path,
        version,
        source: "custom".to_string(),
        is_valid: true,
        is_active: false,
    })
}

#[tauri::command]
pub async fn pick_git_executable(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_opt = app.dialog().file().blocking_pick_file();
    Ok(file_opt.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::process::Command::new(exe).spawn();
    }
    app.exit(0);
    Ok(())
}
