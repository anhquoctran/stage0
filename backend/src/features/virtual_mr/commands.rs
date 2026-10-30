mod attachment_commands;
pub use attachment_commands::*;

use crate::core::db::Database;
use crate::features::git::ops::{get_commits_between, get_git_user_identity, GitCommitItem};
use crate::features::virtual_mr::persistence::{
    VirtualMrCommentDb, VirtualMrDiscussionDb, VirtualMrSessionDb, VirtualMrSessionSaveOutcome,
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
    let result: Result<_, String> = async {
        let db = app.state::<Database>();
        db.list_virtual_mr_sessions(&repo_id)
            .map_err(|e| e.to_string())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn save_virtual_mr_session(
    app: AppHandle,
    session: VirtualMrSessionDb,
) -> Result<VirtualMrSessionSaveOutcome, String> {
    let result: Result<_, String> = async {
        let db = app.state::<Database>();
        db.save_virtual_mr_session(&session)
            .map_err(|e| e.to_string())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn delete_virtual_mr_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let result: Result<_, String> = async {
        let db = app.state::<Database>();
        db.delete_virtual_mr_session(&session_id)
            .map_err(|e| e.to_string())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn get_commits_between_refs(
    repo_path: String,
    base: String,
    compare: String,
) -> Result<Vec<GitCommitItem>, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            get_commits_between(&repo_path, &base, &compare)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn get_git_ref_sha(repo_path: String, reference: String) -> Result<String, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            crate::features::git::runner::resolve_ref(&repo_path, &reference).map(|(sha, _)| sha)
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn get_git_user_identity_cmd(repo_path: String) -> Result<(String, String), String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || get_git_user_identity(&repo_path))
            .await
            .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

// ===========================================================================
// Discussions & Comments Commands
// ===========================================================================

const MAX_DISCUSSION_SOURCE_BYTES: u64 = 16 * 1024 * 1024;

fn read_regular_text_file_capped(path: &Path, max_bytes: u64) -> Result<String, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect source file: {}", error))?;
    if !metadata.file_type().is_file() {
        return Err(crate::common::messages::code("backend.virtualMr.sourceNotRegularFile"));
    }
    if metadata.len() > max_bytes {
        return Err(crate::common::messages::code("backend.virtualMr.sourceFileTooLarge"));
    }

    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    std::fs::File::open(path)
        .and_then(|file| file.take(max_bytes + 1).read_to_end(&mut bytes))
        .map_err(|error| format!("Unable to read source file: {}", error))?;
    if bytes.len() as u64 > max_bytes {
        return Err(crate::common::messages::code("backend.virtualMr.sourceFileTooLarge"));
    }
    String::from_utf8(bytes).map_err(|_| crate::common::messages::code("backend.virtualMr.sourceNotUtf8"))
}

#[tauri::command]
pub async fn list_mr_discussions(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let db = app.state::<Database>();
            let manager = app.state::<crate::features::sandbox::SandboxManager>();
            crate::features::review::discussion_snippets::list_with_code_context(
                &db,
                &session_id,
                std::sync::Arc::clone(manager.guardrails()),
            )
        })
        .await
        .map_err(|_| "Could not load discussion code context".to_string())?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn create_mr_discussion(
    app: AppHandle,
    mut discussion: VirtualMrDiscussionDb,
    first_comment: VirtualMrCommentDb,
) -> Result<(), String> {
    let result: Result<_, String> = async {
        if discussion.resolve_type == "ai_verified"
            || discussion.verification_status == "pass"
            || discussion.verified_by_bot.is_some()
        {
            crate::features::ai::review_availability::require_review_runtime()?;
        }
        tauri::async_runtime::spawn_blocking(move || {
            let db = app.state::<Database>();

            if let Some(snippet) = &mut discussion.code_snippet {
                let line = discussion
                    .line_number
                    .ok_or("A code snippet requires a selected line")?;
                if snippet.start_line < 1
                    || snippet.lines.is_empty()
                    || snippet.lines.len() > 15
                    || snippet.lines.iter().any(|line| line.len() > 8192)
                    || snippet.lines.iter().map(String::len).sum::<usize>() > 32768
                    || line < snippet.start_line
                    || line >= snippet.start_line + snippet.lines.len() as i64
                    || snippet
                        .selected_end_line
                        .is_some_and(|end| end < line || end - line >= 200)
                    || snippet
                        .format
                        .as_deref()
                        .is_some_and(|format| !matches!(format, "diff" | "plain"))
                    || discussion.file_path.is_none()
                    || !matches!(discussion.diff_side.as_deref(), Some("left" | "right"))
                {
                    return Err(crate::common::messages::code("backend.virtualMr.snippetInvalid"));
                }
                snippet.selected_line = Some(line);
                // Anchor to the selected diff snapshot, including old-side deleted lines.
                let content = snippet.lines.join("\n");
                let (hash, before, after) = crate::features::git::anchor::extract_line_fingerprint(
                    &content,
                    (line - snippet.start_line + 1) as usize,
                );
                discussion.content_hash = Some(hash);
                discussion.context_before = before;
                discussion.context_after = after;
            }
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
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn add_mr_comment(app: AppHandle, comment: VirtualMrCommentDb) -> Result<(), String> {
    let result: Result<_, String> = async {
        let db = app.state::<Database>();
        db.add_comment(&comment).map_err(|e| e.to_string())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn resolve_mr_discussion(
    app: AppHandle,
    discussion_id: String,
    is_resolved: bool,
    resolve_type: String,
    resolved_by: Option<String>,
) -> Result<(), String> {
    let result: Result<_, String> = async {
        if resolve_type == "ai_verified" {
            crate::features::ai::review_availability::require_review_runtime()?;
        }
        let db = app.state::<Database>();
        db.resolve_discussion(
            &discussion_id,
            is_resolved,
            &resolve_type,
            resolved_by.as_deref(),
        )
        .map_err(|e| e.to_string())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn verify_mr_discussion(
    app: AppHandle,
    discussion_id: String,
    verification_status: String,
    verified_by_bot: String,
    pass: bool,
) -> Result<(), String> {
    let result: Result<_, String> = async {
        // A client-supplied boolean is not verification evidence. The sandboxed
        // review runtime validates current-snapshot evidence before resolving.
        let _ = (
            app,
            discussion_id,
            verification_status,
            verified_by_bot,
            pass,
        );
        crate::features::ai::review_availability::require_review_runtime()
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn reanchor_file_discussions(
    app: AppHandle,
    session_id: String,
    file_path: String,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    let result: Result<_, String> = async {
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
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[cfg(test)]
mod discussion_file_tests {
    use super::attachment_commands::{
        sanitize_attachment_filename, validate_and_normalize_image_mime,
    };
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

    #[test]
    fn validates_image_mimes_strictly() {
        assert!(validate_and_normalize_image_mime("test.png", "image/png").is_ok());
        assert!(validate_and_normalize_image_mime("photo.jpg", "image/jpeg").is_ok());
        assert!(validate_and_normalize_image_mime("drawing.svg", "image/svg+xml").is_ok());
        assert!(validate_and_normalize_image_mime("clip.webp", "image/webp").is_ok());
        assert!(validate_and_normalize_image_mime("anim.gif", "image/gif").is_ok());

        assert!(validate_and_normalize_image_mime("doc.pdf", "application/pdf").is_err());
        assert!(validate_and_normalize_image_mime("run.exe", "application/x-msdownload").is_err());
        assert!(validate_and_normalize_image_mime("script.sh", "text/x-shellscript").is_err());
        assert!(validate_and_normalize_image_mime("archive.zip", "application/zip").is_err());
    }

    #[test]
    fn sanitizes_image_filenames_safely() {
        assert_eq!(
            sanitize_attachment_filename("../../../etc/passwd.png"),
            "etc_passwd.png"
        );
        assert_eq!(
            sanitize_attachment_filename("my cool photo (1).png"),
            "my_cool_photo__1_.png"
        );
        assert_eq!(sanitize_attachment_filename("..."), "attachment");
    }
}
