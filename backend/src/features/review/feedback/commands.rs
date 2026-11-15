use super::{memories, FeedbackMemory};
use crate::core::db::Database;
use rusqlite::params;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn list_review_feedback_memories(
    app: AppHandle,
    repo_id: String,
) -> Result<Vec<FeedbackMemory>, String> {
    tauri::async_runtime::spawn_blocking(move || memories(&app.state::<Database>(), &repo_id))
        .await
        .map_err(|_| crate::common::messages::code("backend.errors.review"))?
        .map_err(|e| crate::common::messages::command_error("review", e))
}

/// Retain a body-free tombstone so the same human comment is not learned again.
#[tauri::command]
pub async fn forget_review_feedback(
    app: AppHandle,
    repo_id: String,
    memory_id: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        forget(&app.state::<Database>(), &repo_id, &memory_id)
    })
    .await
    .map_err(|_| crate::common::messages::code("backend.errors.review"))?
    .map_err(|e| crate::common::messages::command_error("review", e))
}

pub(super) fn forget(db: &Database, repo: &str, id: &str) -> Result<(), String> {
    db.conn().execute("UPDATE review_feedback SET active=0,finding='',feedback='',reason='',updated_at=?3 WHERE repo_id=?1 AND id=?2",
        params![repo,id,chrono::Utc::now().to_rfc3339()]).map_err(|e| e.to_string())?;
    Ok(())
}
