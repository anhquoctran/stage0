use crate::features::git::ops::{git_sync_with_progress, is_rebase_in_progress, GitSyncOptions};

#[tauri::command]
pub async fn run_git_sync(
    repo_path: String,
    operation: String,
    options: Option<GitSyncOptions>,
    on_progress: tauri::ipc::Channel<crate::features::git::progress::GitOperationProgress>,
) -> Result<String, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let _lease = crate::features::git::GitOperationLease::acquire(&repo_path)?;
            git_sync_with_progress(&repo_path, &operation, options, Some(on_progress))
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn check_rebase_status(repo_path: String) -> Result<bool, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || Ok(is_rebase_in_progress(&repo_path)))
            .await
            .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}
