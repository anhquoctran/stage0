#[tauri::command]
pub async fn get_file_text_diff(
    repo_path: String,
    old_ref: Option<String>,
    new_ref: String,
    file_path: String,
    old_path: Option<String>,
    encoding: Option<String>,
) -> Result<crate::features::git::file_text_diff::FileTextDiff, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        crate::features::git::file_text_diff::get_file_text_diff(
            &repo_path,
            old_ref.as_deref(),
            &new_ref,
            &file_path,
            old_path.as_deref(),
            encoding.as_deref(),
        )
    })
    .await
    .map_err(|_| "File encoding preview task failed".to_owned())?;
    result.map_err(|error| crate::common::messages::command_error("git", error))
}
