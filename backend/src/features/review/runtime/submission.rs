use super::{review_actions::deduplicate, tool_state::ReviewToolState};
use crate::core::db::Database;
use crate::features::review::{context::ReviewContext, ReviewFinding, ReviewRun, ReviewToolCall};
use crate::features::review::{debug_log, security};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

/// Returns true only after the validated findings and discussion actions are published.
pub(super) async fn submit_review(
    db: &Database,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    call: ReviewToolCall,
    state: &mut ReviewToolState,
    results: &mut Vec<(ReviewToolCall, Value)>,
) -> Result<bool, String> {
    let submitted_findings: Vec<ReviewFinding> =
        serde_json::from_value(call.arguments["findings"].clone())
            .map_err(|_| "Malformed structured findings")?;
    let submitted_decision = call.arguments["decision"].as_str().unwrap().to_owned();
    let mut findings = state.pending_findings.clone();
    findings.extend(submitted_findings);
    let findings = deduplicate(findings);
    if findings.len() > 50 {
        state.had_errors = true;
        debug_log::log(format_args!(
            "event=tool_call_rejected run={} turn={} tool=submit_review reason=finding_limit findings={}",
            debug_log::safe_label(&run.id, 80),
            run.turns,
            findings.len()
        ));
        results.push((
            call,
            json!({"isError":true,"error":"A review may contain at most 50 inline findings"}),
        ));
        return Ok(false);
    }
    let validation = {
        let context = Arc::clone(context);
        let findings = findings.clone();
        tauri::async_runtime::spawn_blocking(move || {
            context
                .lock()
                .map_err(|_| "Review context unavailable".to_string())?
                .validate_findings(&findings)
        })
        .await
        .map_err(|_| "Finding validation task failed")?
    };
    if validation.is_ok() {
        let ctx = context.lock().map_err(|_| "Review context unavailable")?;
        run.findings = findings;
        run.summary = security::redact(call.arguments["summary"].as_str().unwrap());
        run.decision = Some(submitted_decision.clone());
        run.inspected_files = ctx.inspected.iter().cloned().collect();
        run.context_bytes = ctx.bytes;
        run.status = if state.had_errors
            || ctx.limited
            || !run.snapshot.excluded_files.is_empty()
            || run
                .snapshot
                .changed_files
                .iter()
                .any(|path| !ctx.complete_diffs.contains(path))
        {
            "partial"
        } else {
            "completed"
        }
        .into();
        drop(ctx);
        if submitted_decision == "approve" {
            let has_unresolved_discussions = db
                .list_discussions(&run.session_id)
                .map_err(|error| error.to_string())?
                .iter()
                .any(|discussion| {
                    !discussion.is_resolved && !state.resolved_discussions.contains(&discussion.id)
                });
            if run.status != "completed" || !run.findings.is_empty() || has_unresolved_discussions {
                debug_log::log(format_args!(
                    "event=tool_call_rejected run={} turn={} tool=submit_review reason=approval_guard coverage_status={} findings={} unresolved_discussions={}",
                    debug_log::safe_label(&run.id, 80),
                    run.turns,
                    run.status,
                    run.findings.len(),
                    has_unresolved_discussions
                ));
                run.decision = None;
                run.status = "running".into();
                results.push((
                    call,
                    json!({"isError":true,"error":"Approval requires complete diff coverage, no findings, and no unresolved discussions. Finish or describe the remaining review work, then submit a non-approval decision."}),
                ));
                state.had_errors = true;
                return Ok(false);
            }
        }
        db.publish_review_actions(run, &state.pending_discussion_actions)?;
        run.published = true;
        db.review_event(
            &run.id,
            "submitted",
            json!({"findingCount":run.findings.len(),"discussionActions":state.pending_discussion_actions.len(),"coverage":run.status}),
        )?;
        debug_log::log(format_args!(
            "event=review_submitted run={} decision={} status={} findings={} discussion_actions={} inspected_files={} context_bytes={}",
            debug_log::safe_label(&run.id, 80),
            debug_log::safe_label(&submitted_decision, 40),
            run.status,
            run.findings.len(),
            state.pending_discussion_actions.len(),
            run.inspected_files.len(),
            run.context_bytes
        ));
        return Ok(true);
    }
    state.had_errors = true;
    let validation_error = validation.unwrap_err();
    debug_log::log(format_args!(
        "event=tool_call_rejected run={} turn={} tool=submit_review reason=finding_validation error_class={}",
        debug_log::safe_label(&run.id, 80),
        run.turns,
        debug_log::error_class(&validation_error)
    ));
    results.push((call, json!({"isError":true,"error":validation_error})));
    return Ok(false);
}
