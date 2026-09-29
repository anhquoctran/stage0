use std::path::Path;
use tauri::{AppHandle, Manager, Window};
use tauri_plugin_dialog::DialogExt;
use crate::db::Database;
use crate::git::{
    branches::list_branches,
    conflict::check_conflicts,
    diff::get_mr_diff as calc_mr_diff,
    ops::{git_sync, list_remotes, get_remote_url, is_rebase_in_progress, GitSyncOptions},
    blame::get_file_blame as calc_file_blame,
    BranchList, ConflictReport, MrDiffPayload, RepoInfo, FileBlamePayload,
};
use crate::watcher::WatcherState;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RepoValidation {
    pub is_valid: bool,
    pub exists: bool,
    pub has_git: bool,
    pub has_permission: bool,
    pub error_message: Option<String>,
}

#[tauri::command]
pub async fn open_repo_dialog(app: AppHandle) -> Result<Option<RepoInfo>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();

    let folder_path = match folder_opt {
        Some(fp) => fp.to_string(),
        None => return Ok(None),
    };

    let path = Path::new(&folder_path);
    if !path.join(".git").exists() {
        return Err("The selected directory is not a valid Git repository (missing .git directory)".to_string());
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Repository".to_string());

    let id = uuid::Uuid::new_v4().to_string();

    let db = app.state::<Database>();
    db.upsert_repository(&id, &name, &folder_path)
        .map_err(|e| format!("Failed to save repository to database: {}", e))?;

    let watcher = app.state::<WatcherState>();
    if let Err(e) = watcher.watch_repo(app.clone(), folder_path.clone()) {
        eprintln!("Warning: Failed to start watcher: {}", e);
    }

    Ok(Some(RepoInfo {
        id,
        name,
        local_path: folder_path,
    }))
}

#[tauri::command]
pub async fn open_repo_by_path(app: AppHandle, repo_path: String) -> Result<RepoInfo, String> {
    let path = Path::new(&repo_path);
    if !path.exists() {
        return Err("The repository path does not exist on disk".to_string());
    }
    if !path.join(".git").exists() {
        return Err("The directory is not a valid Git repository (missing .git)".to_string());
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Repository".to_string());

    let id = uuid::Uuid::new_v4().to_string();

    let db = app.state::<Database>();
    db.upsert_repository(&id, &name, &repo_path)
        .map_err(|e| format!("Failed to save repository to database: {}", e))?;

    let watcher = app.state::<WatcherState>();
    if let Err(e) = watcher.watch_repo(app.clone(), repo_path.clone()) {
        eprintln!("Warning: Failed to start watcher: {}", e);
    }

    Ok(RepoInfo {
        id,
        name,
        local_path: repo_path,
    })
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
pub async fn get_branches(app: AppHandle, repo_path: String) -> Result<BranchList, String> {
    let watcher = app.state::<WatcherState>();
    let _ = watcher.watch_repo(app.clone(), repo_path.clone());
    list_branches(&repo_path)
}

#[tauri::command]
pub async fn get_mr_diff(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<MrDiffPayload, String> {
    calc_mr_diff(&repo_path, &base, &compare)
}

#[tauri::command]
pub async fn check_merge_conflicts(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<ConflictReport, String> {
    check_conflicts(&repo_path, &base, &compare)
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


