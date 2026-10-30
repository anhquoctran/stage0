use crate::features::git::{
    blame::get_file_blame as calc_file_blame,
    graph::{
        get_commit_message as load_commit_message,
        get_current_branch_graph as load_current_branch_graph,
        search_commit_messages as search_branch_commit_messages,
    },
    ConflictFilePreview, ConflictReport, FileBlamePayload, MrDiffPayload,
};
use crate::features::sandbox::SandboxManager;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn get_git_commit_details(
    repo_path: String,
    commit_hash: String,
) -> Result<crate::features::git::CommitDetail, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            crate::features::git::commit_details::get_commit_details(&repo_path, &commit_hash)
        })
        .await
        .map_err(|error| format!("Task execution failed: {error}"))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_current_branch_graph(
    repo_path: String,
) -> Result<crate::features::git::graph::GitGraph, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || load_current_branch_graph(&repo_path))
            .await
            .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_git_commit_message(
    repo_path: String,
    commit_hash: String,
) -> Result<String, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || load_commit_message(&repo_path, &commit_hash))
            .await
            .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn search_git_commit_messages(
    repo_path: String,
    query: String,
    case_sensitive: bool,
    commit_hashes: Vec<String>,
) -> Result<Vec<String>, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            search_branch_commit_messages(&repo_path, &query, case_sensitive, &commit_hashes)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_mr_diff(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<MrDiffPayload, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let manager = app.state::<SandboxManager>();
            manager.get_mr_diff(&repo_path, &base, &compare)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn check_merge_conflicts(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
) -> Result<ConflictReport, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let manager = app.state::<SandboxManager>();
            manager.check_conflicts(&repo_path, &base, &compare)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_conflicted_file_preview(
    app: AppHandle,
    repo_path: String,
    base: String,
    compare: String,
    file_path: String,
) -> Result<ConflictFilePreview, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let manager = app.state::<SandboxManager>();
            manager.get_conflict_preview(&repo_path, &base, &compare, &file_path)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}

#[tauri::command]
pub async fn get_file_blame(
    repo_path: String,
    file_path: String,
    revision: Option<String>,
    ignore_whitespace: Option<bool>,
) -> Result<FileBlamePayload, String> {
    let result: Result<_, String> = async {
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
    .await;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}
