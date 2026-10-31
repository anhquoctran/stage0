use super::engine::{MAX_REQUEST_BYTES, MAX_REVIEW_WIRE_BYTES};
use crate::core::db::Database;
use crate::features::review::{
    context::{PreparedDiffBatch, ReviewContext},
    model_adapter::ReviewModelAdapter,
    ReviewRun,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

pub(super) async fn prepare(
    context: &Arc<Mutex<ReviewContext>>,
    adapter: &dyn ReviewModelAdapter,
    system: &str,
    initial: &Value,
    tools: &[Value],
    reply_only: bool,
) -> Result<(Vec<Value>, Option<PreparedDiffBatch>), String> {
    if reply_only {
        return Ok((adapter.initial_history(&initial.to_string()), None));
    }
    let mut initial = initial.clone();
    let mut limit = {
        let context = context.lock().map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?;
        if context.snapshot.changed_files.is_empty() {
            return Ok((adapter.initial_history(&initial.to_string()), None));
        }
        context.initial_diff_limit()
    };
    // Reserve a follow-up turn (description then review) without splitting a
    // packet that already fits. ACP continuations carry deltas, unlike native HTTP.
    let request_target =
        MAX_REQUEST_BYTES.min(MAX_REVIEW_WIRE_BYTES / (2 * adapter.retry_reserve_factor().max(1)));
    while limit >= 512 {
        let worker_context = Arc::clone(context);
        let prepared = tauri::async_runtime::spawn_blocking(move || {
            worker_context
                .lock()
                .map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?
                .prepare_diff_batch(0, 0, limit, true)
        })
        .await
        .map_err(|_| crate::common::messages::failure("backend.review.initialDiffsPrepareFailed", serde_json::json!({}), "Could not prepare initial review diffs".into()))?;
        let batch = match prepared {
            Ok(batch) => batch,
            Err(error) => {
                initial["diffBatch"] = json!({"error":error,"next":{"fileOffset":0,"diffOffset":0},"coverageCompleteAfterDelivery":false});
                return Ok((adapter.initial_history(&initial.to_string()), None));
            }
        };
        initial["diffBatch"] = batch.value.clone();
        let history = adapter.initial_history(&initial.to_string());
        let body = adapter.payload(system, &history, tools, 2048);
        if adapter.request_size(&body) <= request_target {
            return authorize(Arc::clone(context), batch, history, limit);
        }
        limit /= 2;
    }
    initial["diffBatch"] = json!({"error":"Initial source packet does not fit the request/context budget; use bounded diff tools", "next":{"fileOffset":0,"diffOffset":0},"coverageCompleteAfterDelivery":false});
    Ok((adapter.initial_history(&initial.to_string()), None))
}

fn authorize(
    context: Arc<Mutex<ReviewContext>>,
    batch: PreparedDiffBatch,
    history: Vec<Value>,
    limit: usize,
) -> Result<(Vec<Value>, Option<PreparedDiffBatch>), String> {
    context
        .lock()
        .map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?
        .authorize_diff_batch(&batch, limit)?;
    Ok((history, Some(batch)))
}

pub(super) fn delivered(
    db: &Database,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    batch: PreparedDiffBatch,
) -> Result<(), String> {
    let segments = batch.value["files"].as_array().map_or(0, Vec::len);
    let remaining = !batch.value["next"].is_null();
    let mut ctx = context.lock().map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?;
    ctx.commit_diff_batch(batch);
    run.context_bytes = ctx.bytes;
    run.inspected_files = ctx.inspected.iter().cloned().collect();
    let complete = ctx.complete_diffs.len();
    drop(ctx);
    db.review_event(&run.id, "initial_diff_delivered", json!({"fileSegments":segments,"completeFiles":complete,"hasMoreBatches":remaining,"contextBytes":run.context_bytes}))
}
