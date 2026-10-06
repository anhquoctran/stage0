use crate::db::{
    Database, RepoLabelDb, RepoSettingsDb, VirtualMrCommentDb, VirtualMrDiscussionDb,
    VirtualMrSessionDb,
};
use crate::git::{
    blame::get_file_blame as calc_file_blame,
    branches::list_branches,
    ops::{
        add_remote, create_branch, create_tag, delete_branch, delete_tag, get_commits_between,
        get_git_user_identity, get_remote_url, git_sync, is_rebase_in_progress, list_remotes,
        list_remotes_detailed, list_tags_detailed, remove_remote, rename_branch, set_remote_url,
        test_remote_connection, GitCommitItem, GitRemoteDetail, GitSyncOptions, GitTagInfo,
    },
    BranchList, ConflictFilePreview, ConflictReport, FileBlamePayload, MrDiffPayload, RepoInfo,
};
use crate::sandbox::{
    GuardrailAuditEvent, GuardrailEvaluationResult, GuardrailMode, GuardrailPolicy,
    SandboxAdapterInfo, SandboxExecutionResult, SandboxInstanceInfo, SandboxManager, SandboxType,
};
use crate::window_manager::{
    close_repo_for_window, create_welcome_window, default_window_size, minimum_window_size,
    open_repo_path, resolve_repository, OpenRepoOutcome, WindowManagerState, WindowStartupContext,
};
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Manager, WebviewWindow, Window};
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
    let full_path = crate::git::resolve_safe_repo_path(&repo_path, &file_path)?;
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
    let full_path = crate::git::resolve_safe_repo_path(&repo_path, &file_path)?;
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
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_webview_devtools(window: WebviewWindow) -> Result<(), String> {
    window.open_devtools();
    Ok(())
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
pub async fn window_maximize(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_reset_size(window: Window) -> Result<(), String> {
    let _ = window.unmaximize();
    let (min_width, min_height) = minimum_window_size();
    let min_size = tauri::LogicalSize {
        width: min_width,
        height: min_height,
    };
    let (width, height) = default_window_size();
    window
        .set_min_size(Some(tauri::Size::Logical(min_size)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    let _ = window.center();
    Ok(())
}

#[tauri::command]
pub async fn window_show(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn list_git_credentials(
    app: AppHandle,
) -> Result<Vec<crate::credentials::GitCredentialMeta>, String> {
    let db = app.state::<Database>();
    db.get_all_git_credentials()
        .map_err(|e| format!("Failed to load git credentials: {}", e))
}

#[tauri::command]
pub async fn save_git_credential(
    app: AppHandle,
    payload: crate::credentials::SaveGitCredentialPayload,
) -> Result<crate::credentials::GitCredentialMeta, String> {
    let crate::credentials::SaveGitCredentialPayload {
        provider,
        server_url,
        account_name,
        token_type,
        label,
        secret,
    } = payload;
    let secret = Zeroizing::new(secret);

    if account_name.trim().is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    if secret.trim().is_empty() {
        return Err("Secret / token cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let token_ref = format!("st0_tok_{}", uuid::Uuid::new_v4().simple());

    // 1. Store secret in OS Credential Manager
    crate::credentials::store_secret(&token_ref, secret.trim())?;

    // 2. Store tokenized record in SQLite
    let db = app.state::<Database>();
    if let Err(e) = db.insert_git_credential(
        &id,
        &provider,
        &server_url,
        account_name.trim(),
        &token_ref,
        &token_type,
        label.as_deref(),
    ) {
        // Rollback keyring secret if db fails
        let _ = crate::credentials::delete_secret(&token_ref);
        return Err(format!("Failed to save credential to database: {}", e));
    }

    Ok(crate::credentials::GitCredentialMeta {
        id,
        provider,
        server_url,
        account_name,
        token_ref,
        token_type,
        label,
        source: "stage0".to_string(),
        helper_name: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        is_in_keyring: true,
    })
}

#[tauri::command]
pub async fn delete_git_credential(app: AppHandle, id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    let source = db
        .get_git_credential_source(&id)
        .map_err(|error| format!("Failed to query credential source: {error}"))?;
    if source.as_deref() == Some("system_global") {
        return Err(
            "This credential is managed by the system/global Git helper and cannot be deleted here."
                .to_string(),
        );
    }
    let token_ref = db
        .get_git_credential_token_ref(&id)
        .map_err(|e| format!("Failed to query credential: {}", e))?;
    if let Some(token_ref) = token_ref {
        // Remove the secret first so a database failure can leave only stale
        // metadata, never an orphaned credential that the user thought deleted.
        crate::credentials::delete_secret(&token_ref)?;
        db.delete_git_credential(&id)
            .map_err(|e| format!("Failed to delete credential metadata: {}", e))?;
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

#[tauri::command]
pub async fn store_ai_api_key(provider: String, api_key: String) -> Result<(), String> {
    let p = provider.trim();
    let k = api_key.trim();
    if p.is_empty() {
        return Err("AI provider cannot be empty".to_string());
    }
    if k.is_empty() {
        return crate::credentials::delete_ai_key(p);
    }
    crate::credentials::store_ai_key(p, k)
}

#[tauri::command]
pub async fn has_ai_api_key(provider: String) -> Result<bool, String> {
    let p = provider.trim();
    if p.is_empty() {
        return Ok(false);
    }
    crate::credentials::ai_key_exists(p)
}

#[tauri::command]
pub async fn delete_ai_api_key(provider: String) -> Result<(), String> {
    let p = provider.trim();
    if p.is_empty() {
        return Ok(());
    }
    crate::credentials::delete_ai_key(p)
}

// ---------------------------------------------------------------------------
// AI Cloud Subscription & CLI Bridge Commands (Phases 1, 2, 3)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ai_detect_cli(cli_type: String) -> Result<crate::ai::cli_bridge::CliDetectionResult, String> {
    Ok(crate::ai::cli_bridge::detect_cli(&cli_type).await)
}

#[tauri::command]
pub async fn ai_execute_cli(
    cli_type: String,
    prompt: String,
    repo_path: Option<String>,
) -> Result<crate::ai::cli_bridge::CliExecutionResult, String> {
    crate::ai::cli_bridge::execute_cli(&cli_type, &prompt, repo_path.as_deref()).await
}

#[tauri::command]
pub async fn copilot_start_device_flow(
    client_id: Option<String>,
) -> Result<crate::ai::copilot::CopilotDeviceCodeResponse, String> {
    crate::ai::copilot::start_copilot_device_flow(client_id).await
}

#[tauri::command]
pub async fn copilot_poll_token(
    device_code: String,
    client_id: Option<String>,
) -> Result<crate::ai::copilot::CopilotPollResponse, String> {
    crate::ai::copilot::poll_copilot_token(&device_code, client_id).await
}

#[tauri::command]
pub async fn copilot_check_status() -> Result<crate::ai::copilot::CopilotAuthStatus, String> {
    Ok(crate::ai::copilot::check_copilot_auth_status().await)
}

#[tauri::command]
pub async fn copilot_disconnect() -> Result<(), String> {
    crate::ai::copilot::disconnect_copilot()
}

#[tauri::command]
pub async fn google_oauth_start(
    client_id: Option<String>,
) -> Result<crate::ai::google_oauth::GoogleOAuthStartResult, String> {
    crate::ai::google_oauth::start_google_oauth(client_id).await
}

#[tauri::command]
pub async fn google_oauth_check_status() -> Result<crate::ai::google_oauth::GoogleAuthStatus, String> {
    Ok(crate::ai::google_oauth::check_google_auth_status().await)
}

#[tauri::command]
pub async fn google_oauth_disconnect() -> Result<(), String> {
    crate::ai::google_oauth::disconnect_google()
}

#[tauri::command]
pub async fn chatgpt_oauth_start(
    client_id: Option<String>,
) -> Result<crate::ai::chatgpt_oauth::ChatGptOAuthStartResult, String> {
    crate::ai::chatgpt_oauth::start_chatgpt_oauth(client_id).await
}

#[tauri::command]
pub async fn chatgpt_oauth_check_status() -> Result<crate::ai::chatgpt_oauth::ChatGptAuthStatus, String> {
    Ok(crate::ai::chatgpt_oauth::check_chatgpt_auth_status().await)
}

#[tauri::command]
pub async fn chatgpt_oauth_disconnect() -> Result<(), String> {
    crate::ai::chatgpt_oauth::disconnect_chatgpt_subscription()
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    crate::ai::open_system_browser(&url)
}

#[tauri::command]
pub async fn ai_chat_dispatch(
    req: crate::ai::UnifiedAiChatRequest,
) -> Result<crate::ai::UnifiedAiChatResponse, String> {
    crate::ai::dispatch_ai_chat(req).await
}

#[tauri::command]
pub async fn fetch_ai_models(
    provider: String,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<Vec<crate::ai::dynamic_models::DynamicModelInfo>, String> {
    crate::ai::dynamic_models::fetch_provider_models(
        &provider,
        api_key.as_deref(),
        base_url.as_deref(),
    )
    .await
}

// ---------------------------------------------------------------------------
// Sandbox Adapter Management Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_available_sandboxes(app: AppHandle) -> Result<Vec<SandboxAdapterInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        Ok(manager.list_available_adapters())
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn get_active_sandbox(app: AppHandle) -> Result<SandboxType, String> {
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
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.create_instance(&repo_path, &base, &compare)
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn destroy_sandbox_instance(app: AppHandle, instance_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.destroy_instance(&instance_id)
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn list_sandbox_instances(app: AppHandle) -> Result<Vec<SandboxInstanceInfo>, String> {
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
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        let instance = manager
            .get_instance(&instance_id)
            .ok_or_else(|| format!("Sandbox instance not found: {}", instance_id))?;
        let evaluation = manager
            .guardrails()
            .evaluate_command(&command, &args, &instance.adapter_type)
            .map_err(|violation| format!("🛡️ Guardrail Policy Blocked: {}", violation.message))?;
        if evaluation.requires_confirmation {
            manager.guardrails().record_policy_denial(
                "execute_terminal_cmd",
                &command,
                crate::sandbox::GuardrailViolation {
                    rule: "HUMAN_CONFIRMATION_REQUIRED".to_string(),
                    severity: crate::sandbox::GuardrailSeverity::High,
                    message: "The command requires human confirmation. Stage0 has no approval dialog for tool calls, so it was not executed.".to_string(),
                },
            );
            return Err(
                "Guardrail policy requires human confirmation; Stage0 has no approval dialog for tool calls, so the command was not executed."
                    .to_string(),
            );
        }

        let mut result = manager.execute_command(&instance_id, &command, &args)?;
        let (stdout, stdout_truncated) = manager
            .guardrails()
            .truncate_output_if_needed(&result.stdout);
        let (stderr, stderr_truncated) = manager
            .guardrails()
            .truncate_output_if_needed(&result.stderr);
        if stdout_truncated {
            result.stdout = stdout.into_owned();
        }
        if stderr_truncated {
            result.stderr = stderr.into_owned();
        }
        result.output_truncated |= stdout_truncated || stderr_truncated;
        Ok(result)
    })
    .await
    .map_err(|e| format!("Sandbox task join error: {}", e))?
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();
    Ok(folder_opt.map(|fp| fp.to_string()))
}

#[tauri::command]
pub async fn check_remote_repo_url(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::git::ops::check_git_remote_url(&url))
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
        crate::git::ops::validate_remote_url(trimmed_url)?;

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

        let git_bin = crate::git::runner::get_active_git_path();
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

        let output = crate::process::run_bounded_command(
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
            let stderr =
                crate::git::runner::redact_sensitive_text(&String::from_utf8_lossy(&output.stderr));
            let stdout =
                crate::git::runner::redact_sensitive_text(&String::from_utf8_lossy(&output.stdout));
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
            let _ = crate::credentials::delete_secret(&self.token_ref);
        }
    }
}

fn prepare_clone_credential(
    db: &Database,
    credential_id: &str,
    remote_url: &str,
) -> Result<CloneCredentialLease, String> {
    let target_origin = crate::credentials::https_origin(remote_url)?;
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
    let credential_origin = crate::credentials::https_origin(&credential.server_url)?;
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
            let secret =
                crate::credentials::retrieve_secret(&credential.token_ref).map_err(|_| {
                    "The selected credential is missing from the OS credential store.".to_string()
                })?;
            drop(Zeroizing::new(secret));
            (credential.token_ref, false)
        }
        "system_global" => {
            let secret = crate::credentials::retrieve_system_global_credential_for_clone(
                remote_url,
                &credential.account_name,
            )?;
            let token_ref = format!("st0_clone_{}", uuid::Uuid::new_v4().simple());
            crate::credentials::store_secret(&token_ref, secret.as_str())?;
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

// ===========================================================================
// Virtual MR Sessions, Commits & Identity Commands
// ===========================================================================

#[tauri::command]
pub async fn list_virtual_mr_sessions(
    app: AppHandle,
    repo_id: String,
) -> Result<Vec<VirtualMrSessionDb>, String> {
    let db = app.state::<Database>();
    db.list_virtual_mr_sessions(&repo_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_virtual_mr_session(
    app: AppHandle,
    session: VirtualMrSessionDb,
) -> Result<(), String> {
    let db = app.state::<Database>();
    db.save_virtual_mr_session(&session)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_virtual_mr_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.delete_virtual_mr_session(&session_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_commits_between_refs(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<Vec<GitCommitItem>, String> {
    tauri::async_runtime::spawn_blocking(move || get_commits_between(&repo_path, &base, &compare))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_git_user_identity_cmd(repo_path: String) -> Result<(String, String), String> {
    tauri::async_runtime::spawn_blocking(move || get_git_user_identity(&repo_path))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}

// ===========================================================================
// Discussions & Comments Commands
// ===========================================================================

const MAX_DISCUSSION_SOURCE_BYTES: u64 = 16 * 1024 * 1024;

fn read_regular_text_file_capped(path: &Path, max_bytes: u64) -> Result<String, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect source file: {}", error))?;
    if !metadata.file_type().is_file() {
        return Err("Source path is not a regular file".to_string());
    }
    if metadata.len() > max_bytes {
        return Err("Source file exceeds the 16 MiB discussion analysis limit".to_string());
    }

    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    std::fs::File::open(path)
        .and_then(|file| file.take(max_bytes + 1).read_to_end(&mut bytes))
        .map_err(|error| format!("Unable to read source file: {}", error))?;
    if bytes.len() as u64 > max_bytes {
        return Err("Source file exceeds the 16 MiB discussion analysis limit".to_string());
    }
    String::from_utf8(bytes).map_err(|_| "Source file is not valid UTF-8 text".to_string())
}

#[tauri::command]
pub async fn list_mr_discussions(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    let db = app.state::<Database>();
    db.list_discussions(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_mr_discussion(
    app: AppHandle,
    mut discussion: VirtualMrDiscussionDb,
    first_comment: VirtualMrCommentDb,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Database>();

        // Automatically extract line fingerprint from source file if not provided.
        if discussion.content_hash.is_none() {
            if let (Some(ref file_path), Some(line_num)) =
                (&discussion.file_path, discussion.line_number)
            {
                if line_num > 0 {
                    if let Ok(Some(repo_path)) =
                        db.get_repo_path_for_session(&discussion.session_id)
                    {
                        if let Ok(safe_path) =
                            crate::git::resolve_safe_repo_path(&repo_path, file_path)
                        {
                            if let Ok(content) = read_regular_text_file_capped(
                                &safe_path,
                                MAX_DISCUSSION_SOURCE_BYTES,
                            ) {
                                let (hash, before, after) =
                                    crate::git::anchor::extract_line_fingerprint(
                                        &content,
                                        line_num as usize,
                                    );
                                if !hash.is_empty() {
                                    discussion.content_hash = Some(hash);
                                    discussion.context_before = before;
                                    discussion.context_after = after;
                                }
                            }
                        }
                    }
                }
            }
        }

        db.create_discussion(&discussion, &first_comment)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
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
    db.resolve_discussion(
        &discussion_id,
        is_resolved,
        &resolve_type,
        resolved_by.as_deref(),
    )
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
pub async fn reanchor_file_discussions(
    app: AppHandle,
    session_id: String,
    file_path: String,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Database>();
        let discussions = db
            .list_discussions(&session_id)
            .map_err(|e| e.to_string())?;
        let repo_path = db
            .get_repo_path_for_session(&session_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Session not associated with a repository".to_string())?;

        let target_discussions: Vec<_> = discussions
            .into_iter()
            .filter(|discussion| discussion.file_path.as_deref() == Some(file_path.as_str()))
            .collect();
        if target_discussions.is_empty() {
            return Ok(Vec::new());
        }

        let safe_path = crate::git::resolve_safe_repo_path(&repo_path, &file_path)?;
        let content = read_regular_text_file_capped(&safe_path, MAX_DISCUSSION_SOURCE_BYTES)
            .map_err(|error| format!("Failed to read file for re-anchoring: {}", error))?;

        let reanchored = crate::git::anchor::reanchor_discussions(
            &repo_path,
            &file_path,
            &target_discussions,
            &content,
        );

        // Persist any updated line numbers or outdated status
        db.update_discussion_anchors(&reanchored)
            .map_err(|error| format!("Failed to persist discussion anchors: {}", error))?;

        Ok(reanchored)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn sync_active_sandbox(
    app: AppHandle,
    instance_id: String,
    repo_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.sync_instance(&instance_id, &repo_path)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_sandbox_tool_schemas(app: AppHandle) -> Result<serde_json::Value, String> {
    let manager = app.state::<SandboxManager>();
    let active_type = manager.get_active_type();
    Ok(crate::sandbox::get_tool_schemas(
        &active_type,
        &manager.get_guardrail_policy(),
    ))
}

#[tauri::command]
pub async fn dispatch_sandbox_tool(
    app: AppHandle,
    instance_id: String,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manager = app.state::<SandboxManager>();
        manager.dispatch_tool(&instance_id, &tool_name, arguments)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_guardrail_policy(app: AppHandle) -> Result<GuardrailPolicy, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_guardrail_policy())
}

#[tauri::command]
pub async fn update_guardrail_policy(
    app: AppHandle,
    policy: GuardrailPolicy,
) -> Result<(), String> {
    let manager = app.state::<SandboxManager>();
    manager.update_guardrail_policy(policy);
    Ok(())
}

#[tauri::command]
pub async fn reset_guardrail_policy(
    app: AppHandle,
    mode: String,
) -> Result<GuardrailPolicy, String> {
    let manager = app.state::<SandboxManager>();
    let parsed_mode = match mode.to_lowercase().as_str() {
        "strict" => GuardrailMode::Strict,
        "permissive" => GuardrailMode::Permissive,
        _ => GuardrailMode::Balanced,
    };
    manager.reset_guardrail_policy(parsed_mode);
    Ok(manager.get_guardrail_policy())
}

#[tauri::command]
pub async fn get_guardrail_audit_log(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<GuardrailAuditEvent>, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.get_guardrail_audit_log(limit))
}

#[tauri::command]
pub async fn clear_guardrail_audit_log(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<SandboxManager>();
    manager.clear_guardrail_audit_log();
    Ok(())
}

#[tauri::command]
pub async fn simulate_guardrail_check(
    app: AppHandle,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<GuardrailEvaluationResult, String> {
    let manager = app.state::<SandboxManager>();
    Ok(manager.simulate_guardrail_check(&tool_name, arguments))
}

#[tauri::command]
pub async fn scan_git_binaries(app: AppHandle) -> Result<Vec<crate::git::GitBinaryInfo>, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(crate::git::scan_system_git_binaries(
            active_path.as_deref(),
            active_id.as_deref(),
        ))
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn get_active_git_binary(app: AppHandle) -> Result<crate::git::GitBinaryInfo, String> {
    let db = app.state::<Database>();
    let active_path = db.get_setting("git_binary_path").ok().flatten();
    let active_id = db.get_setting("git_binary_id").ok().flatten();
    tauri::async_runtime::spawn_blocking(move || {
        let binaries =
            crate::git::scan_system_git_binaries(active_path.as_deref(), active_id.as_deref());

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
) -> Result<crate::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::git::test_git_version(&path)
            .map_err(|error| format!("Cannot select invalid Git binary: {}", error))?;

        let db = app.state::<Database>();
        db.set_settings_atomic(&[("git_binary_id", &id), ("git_binary_path", &path)])
            .map_err(|error| format!("Failed to persist selected Git binary: {}", error))?;

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
    })
    .await
    .map_err(|error| format!("Task execution failed: {}", error))?
}

#[tauri::command]
pub async fn validate_custom_git_binary(path: String) -> Result<crate::git::GitBinaryInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let version = crate::git::test_git_version(&path)
            .map_err(|error| format!("Failed to validate Git executable: {}", error))?;

        Ok(crate::git::GitBinaryInfo {
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

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe) = std::env::current_exe() {
            let path_str = exe.to_string_lossy();
            if let Some(app_idx) = path_str.find(".app/Contents/MacOS") {
                let bundle_path = &path_str[..app_idx + 4];
                let _ = std::process::Command::new("open")
                    .args(&["-n", bundle_path])
                    .spawn();
            } else {
                let _ = std::process::Command::new(exe).spawn();
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(exe) = std::env::current_exe() {
            let _ = std::process::Command::new(exe).spawn();
        }
    }

    app.exit(0);
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareAboutInfo {
    pub name: String,
    pub author: String,
    pub package_version: String,
    pub git_commit: String,
    pub arch: String,
    pub version: String,
    pub release_date: String,
    pub current_year: String,
    pub copyright: String,
    pub license: String,
    pub tagline: String,
    pub description: String,
    pub website: String,
    pub os: String,
}

#[tauri::command]
pub fn get_app_info() -> Result<SoftwareAboutInfo, String> {
    const RAW_JSON: &str = include_str!("../about.json");
    let mut info: SoftwareAboutInfo = serde_json::from_str(RAW_JSON)
        .map_err(|e| format!("Failed to parse embedded about metadata: {e}"))?;
    info.os = std::env::consts::OS.to_string();
    Ok(info)
}

#[cfg(test)]
mod discussion_file_tests {
    use super::read_regular_text_file_capped;

    #[test]
    fn discussion_source_reads_are_regular_and_bounded() {
        let directory =
            std::env::temp_dir().join(format!("stage0_discussion_file_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let file = directory.join("source.txt");
        std::fs::write(&file, "safe text").unwrap();

        assert_eq!(
            read_regular_text_file_capped(&file, 16).unwrap(),
            "safe text"
        );
        assert!(read_regular_text_file_capped(&file, 4).is_err());
        assert!(read_regular_text_file_capped(&directory, 16).is_err());

        std::fs::remove_dir_all(directory).unwrap();
    }
}
