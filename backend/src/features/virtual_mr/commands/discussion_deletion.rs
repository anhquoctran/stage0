use crate::core::db::Database;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn delete_mr_comment(
    app: AppHandle,
    comment_id: String,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        super::super::discussion_deletion::delete(&app.state::<Database>(), &comment_id)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| crate::common::messages::command_error("virtualMr", error))
}
