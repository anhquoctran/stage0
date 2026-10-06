use crate::core::db::Database;
use crate::features::git::ops::{get_commits_between, get_git_user_identity, GitCommitItem};
use crate::features::virtual_mr::persistence::{
    VirtualMrCommentDb, VirtualMrDiscussionDb, VirtualMrSessionDb,
};
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Manager};

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
                            crate::features::git::resolve_safe_repo_path(&repo_path, file_path)
                        {
                            if let Ok(content) = read_regular_text_file_capped(
                                &safe_path,
                                MAX_DISCUSSION_SOURCE_BYTES,
                            ) {
                                let (hash, before, after) =
                                    crate::features::git::anchor::extract_line_fingerprint(
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

        let safe_path = crate::features::git::resolve_safe_repo_path(&repo_path, &file_path)?;
        let content = read_regular_text_file_capped(&safe_path, MAX_DISCUSSION_SOURCE_BYTES)
            .map_err(|error| format!("Failed to read file for re-anchoring: {}", error))?;

        let reanchored = crate::features::git::anchor::reanchor_discussions(
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
