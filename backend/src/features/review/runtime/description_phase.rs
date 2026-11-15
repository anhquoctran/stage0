//! Generate required metadata before spending the review budget on investigation.
use super::tool_state::ReviewToolState;
use crate::features::review::{
    context::{PreparedDiffBatch, ReviewContext},
    model_adapter::ReviewModelAdapter,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

pub(super) fn source_ready(
    context: &Arc<Mutex<ReviewContext>>,
    initial: Option<&PreparedDiffBatch>,
) -> Result<bool, String> {
    let ctx = context.lock().map_err(|_| "Review context unavailable")?;
    // A prepared initial packet is projected only for tool selection. Delivery and
    // description validation still commit/check actual coverage after the response.
    Ok(ctx
        .snapshot
        .changed_files
        .iter()
        .all(|p| ctx.complete_diffs.contains(p))
        || initial.is_some_and(|b| b.value["next"].is_null()))
}

pub(super) fn prepare(
    state: &mut ReviewToolState,
    source_ready: bool,
    adapter: &dyn ReviewModelAdapter,
    history: &mut Vec<Value>,
    tools: &[Value],
) -> Vec<Value> {
    if state.description_updated && state.workflow_phase.is_none() {
        return tools.to_vec();
    }
    let phase = if state.description_updated {
        "review"
    } else if source_ready {
        "description"
    } else {
        "inventory"
    };
    if state.workflow_phase != Some(phase) {
        let instruction=match phase {
            "inventory"=>"First read all remaining eligible diff pages using the supplied next cursor. Do not investigate unrelated context or discussions yet. Once the eligible diff inventory is complete, generate the MR description. Source policy and coverage checks still apply.",
            "description"=>"The supplied eligible diff inventory is complete. This turn is only for concise MR description generation, not a full review investigation. Call update_mr_description now using the already supplied changes and state any exclusions. Do not reread delivered source, inspect discussions, search or publish findings in this metadata step. Stage0 rechecks coverage and concurrent user edits before saving.",
            _=>"The description has been generated. Begin the full review now, reusing the already delivered diff context. Inspect relevant discussions and supporting source, then submit evidence-backed findings and coverage limitations. Do not regenerate the description or repeat delivered diffs.",
        };
        history.extend(
            adapter.initial_history(
                &json!({"kind":"host_review_workflow","phase":phase,"instruction":instruction})
                    .to_string(),
            ),
        );
        state.workflow_phase = Some(phase);
    }
    tools
        .iter()
        .filter(|t| match phase {
            "description" => t["name"] == "update_mr_description",
            "inventory" => matches!(
                t["name"].as_str(),
                Some(
                    "get_diff"
                        | "get_diff_batch"
                        | "get_file_diff"
                        | "list_changed_files"
                        | "update_mr_description"
                )
            ),
            _ => true,
        })
        .cloned()
        .collect()
}
