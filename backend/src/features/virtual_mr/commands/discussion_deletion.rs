use super::super::discussion_deletion_outcome::DiscussionDeletionOutcome;
use super::super::persistence::VirtualMrDeletionActivity;
use crate::core::db::Database;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn delete_mr_comment(
    app: AppHandle,
    comment_id: String,
) -> Result<DiscussionDeletionOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        super::super::discussion_deletion::delete_and_notify(
            &app.state::<Database>(),
            &comment_id,
            |outcome| super::super::deletion_notification::send(&app, outcome),
        )
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| crate::common::messages::command_error("virtualMr", error))
}

#[tauri::command]
pub async fn list_mr_deletion_activity(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<VirtualMrDeletionActivity>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>()
            .list_mr_deletion_activity(&session_id)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| crate::common::messages::command_error("virtualMr", error))
}
