use std::path::Path;
use tauri::{AppHandle, Manager, Window};
use tauri_plugin_dialog::DialogExt;
use crate::db::Database;
use crate::git::{
    branches::list_branches,
    conflict::check_conflicts,
    diff::get_mr_diff as calc_mr_diff,
    ops::git_sync,
    BranchList, ConflictReport, MrDiffPayload, RepoInfo,
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
) -> Result<String, String> {
    git_sync(&repo_path, &operation)
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
