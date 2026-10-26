use super::{
    action_dispatch::dispatch_action, submission::submit_review, tool_state::ReviewToolState,
};
use crate::core::db::Database;
use crate::features::review::debug_log;
use crate::features::review::tool_registry::ReviewToolRegistry;
use crate::features::review::{context::ReviewContext, ReviewRequest, ReviewRun, ReviewToolCall};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

pub(super) async fn execute_tool_calls(
    db: &Database,
    config: &ReviewRequest,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    state: &mut ReviewToolState,
    calls: Vec<ReviewToolCall>,
    registry: &ReviewToolRegistry,
) -> Result<(bool, Vec<(ReviewToolCall, Value)>), String> {
    let mut results = Vec::new();
    let mut turn_review_file: Option<String> = None;
    for (tool_index, call) in calls.into_iter().enumerate() {
        run.tool_calls += 1;
        debug_log::log(format_args!(
            "event=tool_call_received run={} turn={} tool_index={} tool={} tool_call_total={}",
            debug_log::safe_label(&run.id, 80),
            run.turns,
            tool_index + 1,
            debug_log::safe_label(&call.name, 100),
            run.tool_calls
        ));
        let valid = registry
            .validate_call(&call.name, &call.arguments)
            .and_then(|()| super::scope::validate_call(state, &call));
        if valid.is_ok() {
            super::audit::output(db, &run.id, &call)?;
            if let Some(file_path) = call.arguments["filePath"].as_str() {
                debug_log::log(format_args!(
                    "event=tool_target run={} turn={} tool={} file={}",
                    debug_log::safe_label(&run.id, 80),
                    run.turns,
                    debug_log::safe_label(&call.name, 100),
                    debug_log::safe_label(file_path, 240)
                ));
            }
        }
        if call.name == "submit_review" && valid.is_ok() && !state.description_updated {
            debug_log::log(format_args!(
                "event=tool_call_rejected run={} turn={} tool=submit_review reason=description_inventory_incomplete",
                debug_log::safe_label(&run.id, 80),
                run.turns
            ));
            results.push((
                call,
                json!({"isError":true,"error":"Complete the whole eligible diff inventory and call update_mr_description before submitting this review."}),
            ));
            continue;
        }
        if state.description_updated {
            let file_path = match call.name.as_str() {
                "get_file_diff"
                | "read_file_range"
                | "create_review_discussion"
                | "resolve_discussion" => call.arguments["filePath"].as_str(),
                _ => None,
            };
            if let Some(file_path) = file_path {
                if turn_review_file
                    .as_deref()
                    .is_some_and(|current| current != file_path)
                {
                    debug_log::log(format_args!(
                        "event=tool_call_rejected run={} turn={} tool={} reason=one_file_per_turn_policy",
                        debug_log::safe_label(&run.id, 80),
                        run.turns,
                        debug_log::safe_label(&call.name, 100)
                    ));
                    results.push((
                        call,
                        json!({"isError":true,"error":"Review one changed file at a time. Finish considering the current file in this turn before moving to another file."}),
                    ));
                    continue;
                }
                turn_review_file.get_or_insert_with(|| file_path.to_owned());
            }
        }
        if call.name == "submit_review" && valid.is_ok() {
            if submit_review(db, run, context, call, state, &mut results).await? {
                return Ok((true, results));
            }
            continue;
        }
        if config.generate_description
            && !state.description_updated
            && matches!(
                call.name.as_str(),
                "create_review_discussion" | "reply_to_discussion" | "resolve_discussion"
            )
        {
            debug_log::log(format_args!(
                "event=tool_call_rejected run={} turn={} tool={} reason=description_inventory_incomplete",
                debug_log::safe_label(&run.id, 80),
                run.turns,
                debug_log::safe_label(&call.name, 100)
            ));
            results.push((
                call,
                json!({"isError":true,"error":"Update the MR description after completing all eligible diffs before taking discussion actions."}),
            ));
            continue;
        }
        let result: Result<Value, String> = if let Err(error) = valid {
            Err(error)
        } else {
            dispatch_action(db, run, context, &call, state).await?
        };
        let value = match result {
            Ok(value) => json!({"isError":false,"result":value}),
            Err(error) => {
                state.had_errors = true;
                json!({"isError":true,"error":error})
            }
        };
        // No raw prompt, source, tool arguments, model reasoning or secrets in logs.
        let output_bytes = value.to_string().len();
        if value["isError"] == false && call.name == "list_open_discussions" {
            for thread in value["result"]["threads"].as_array().into_iter().flatten() {
                db.review_event(&run.id, "discussion_context_delivered", json!({"discussionRevision":thread["discussionRevision"],
                    "comments":thread["comments"].as_array().into_iter().flatten().map(|c| json!({"id":c["id"],"screeningFlags":c["screeningFlags"]})).collect::<Vec<_>>()}))?;
            }
        }
        db.review_event(
            &run.id,
            "tool_result",
            json!({"tool":call.name,"isError":value["isError"],"outputBytes":output_bytes}),
        )?;
        let (complete_diffs, context_bytes, inspected_files) = {
            let ctx = context.lock().map_err(|_| "Review context unavailable")?;
            run.context_bytes = ctx.bytes;
            run.inspected_files = ctx.inspected.iter().cloned().collect();
            (ctx.complete_diffs.len(), ctx.bytes, ctx.inspected.len())
        };
        debug_log::log(format_args!(
            "event=tool_result run={} turn={} tool={} outcome={} output_bytes={} inspected_files={} complete_diffs={} findings={} context_bytes={}",
            debug_log::safe_label(&run.id, 80),
            run.turns,
            debug_log::safe_label(&call.name, 100),
            if value["isError"] == true { "error" } else { "ok" },
            output_bytes,
            inspected_files,
            complete_diffs,
            state.pending_findings.len(),
            context_bytes
        ));
        db.save_review_run(run)?;
        results.push((call, value));
    }

    Ok((false, results))
}
