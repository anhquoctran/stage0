use super::RepoValidation;
use crate::core::db::Database;
use crate::core::window_manager::{
    close_repo_for_window, create_welcome_window, open_repo_path, OpenRepoOutcome,
    WindowManagerState, WindowStartupContext,
};
use crate::features::git::{branches::list_branches, RepoInfo};
use std::path::Path;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

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
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder_opt = app.dialog().file().blocking_pick_folder();
    Ok(folder_opt.map(|fp| fp.to_string()))
}
