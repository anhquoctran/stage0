use crate::features::git::ops::{
    add_remote, create_branch, create_tag, delete_branch, delete_tag, get_remote_url, list_remotes,
    list_remotes_detailed, list_tags_detailed, remove_remote, rename_branch, set_remote_url,
    test_remote_connection, GitRemoteDetail, GitTagInfo,
};
use crate::features::git::{branches::list_branches, BranchList};

#[tauri::command]
pub async fn get_branches(repo_path: String) -> Result<BranchList, String> {
    tauri::async_runtime::spawn_blocking(move || list_branches(&repo_path))
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
