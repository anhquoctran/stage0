use super::{CacheStatus, LocalContextRuntime};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn get_review_context_cache(app: AppHandle) -> Result<CacheStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.try_state::<LocalContextRuntime>()
            .map(|runtime| runtime.status())
            .ok_or_else(|| crate::common::messages::code("backend.errors.review"))
    })
    .await
    .map_err(|_| crate::common::messages::code("backend.errors.review"))?
}
#[tauri::command]
pub async fn clear_review_context_cache(app: AppHandle) -> Result<CacheStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let runtime = app
            .try_state::<LocalContextRuntime>()
            .ok_or_else(|| crate::common::messages::code("backend.errors.review"))?;
        runtime
            .clear()
            .map_err(|e| crate::common::messages::command_error("review", e))?;
        Ok(runtime.status())
    })
    .await
    .map_err(|_| crate::common::messages::code("backend.errors.review"))?
}
#[tauri::command]
pub async fn install_review_context_model(app: AppHandle) -> Result<CacheStatus, String> {
    let runtime = app
        .try_state::<LocalContextRuntime>()
        .ok_or_else(|| crate::common::messages::code("backend.errors.review"))?;
    runtime
        .install()
        .await
        .map_err(|e| crate::common::messages::command_error("review", e))?;
    Ok(runtime.status())
}
