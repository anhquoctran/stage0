use super::LocalContextRuntime;
use crate::features::{preferences::PreferencesManager, review::context::ReviewContext};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

pub(crate) async fn attach(app: AppHandle, context: Arc<Mutex<ReviewContext>>, references: bool) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let enabled = app
            .state::<PreferencesManager>()
            .read()
            .ok()
            .and_then(|d| d.settings)
            .and_then(|v| {
                v.pointer("/ai/aiConfig/localReviewContext")
                    .and_then(|b| b.as_bool())
            })
            .unwrap_or(false);
        if !enabled {
            return;
        }
        if let (Some(runtime), Ok(mut ctx)) =
            (app.try_state::<LocalContextRuntime>(), context.lock())
        {
            ctx.enable_local_context(&runtime);
            ctx.set_context_references(references);
        }
    })
    .await;
}
