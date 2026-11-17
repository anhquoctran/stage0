//! Local execution budgets are separate from a provider's context window or account quota.
use crate::{core::db::Database, features::review::ReviewRun};
use serde_json::{json, Value};

pub(super) fn initial(token_limit: u64, turns: usize, calls: usize) -> Value {
    json!({"tokenLimit":token_limit,"turnLimit":turns,"toolCallLimit":calls,
        "accounting":"Cumulative provider-reported input plus output tokens across requests, including replayed history and discarded truncated responses; not the model context window or account quota.",
        "instruction":"Reuse delivered diffs, request only missing context, and group independent reads. Reserve room for submit_review. Never skip coverage or evidence requirements to fit a budget; if investigation remains incomplete, use decision comment and explain the limits."})
}

pub(super) fn warning(
    run: &ReviewRun,
    token_limit: u64,
    wire_bytes: usize,
    wire_limit: usize,
) -> Option<Value> {
    if run.usage_tokens < token_limit / 2 && wire_bytes < wire_limit / 2 {
        return None;
    }
    Some(json!({"kind":"review_budget_warning",
        "remainingTokens":token_limit.saturating_sub(run.usage_tokens),
        "tokenLimit":token_limit,"reservedWireBytes":wire_bytes,"wireByteLimit":wire_limit,
        "instruction":"At least half of a local execution budget has been consumed. Replayed input and reasoning/output consume tokens on every request. Reuse delivered source, avoid redundant reads, and reserve the next response for submit_review when investigation is complete. Never skip coverage or evidence checks or manufacture approval; submit decision comment with explicit limitations if work remains incomplete. Remaining tokens are shared by input and output, not an output allowance."}))
}

pub(super) fn tokens(db: &Database, run: &ReviewRun, limit: u64) -> Result<String, String> {
    exhausted(
        db,
        run,
        "reported_tokens",
        run.usage_tokens,
        limit,
        "backend.review.tokenBudgetExceededDetails",
        "Review token budget exhausted",
    )
}

pub(super) fn request(
    db: &Database,
    run: &ReviewRun,
    bytes: usize,
    request_limit: usize,
    wire_bytes: usize,
    wire_limit: usize,
) -> Result<String, String> {
    if bytes > request_limit {
        exhausted(
            db,
            run,
            "request_bytes",
            bytes as u64,
            request_limit as u64,
            "backend.review.requestBudgetExceeded",
            "Review request byte budget exhausted",
        )
    } else {
        exhausted(
            db,
            run,
            "reserved_wire_bytes",
            wire_bytes as u64,
            wire_limit as u64,
            "backend.review.wireBudgetExceeded",
            "Review cumulative transport byte budget exhausted",
        )
    }
}

fn exhausted(
    db: &Database,
    run: &ReviewRun,
    resource: &str,
    used: u64,
    limit: u64,
    code: &str,
    diagnostic: &str,
) -> Result<String, String> {
    db.review_event(
        &run.id,
        "budget_exhausted",
        json!({
            "resource":resource,"used":used,"limit":limit,"turn":run.turns,
            "usageTokens":run.usage_tokens,"toolCalls":run.tool_calls,
        }),
    )?;
    super::super::debug_log::log(format_args!(
        "event=review_budget_exhausted run={} resource={} used={} limit={} turn={}",
        super::super::debug_log::safe_label(&run.id, 80),
        resource,
        used,
        limit,
        run.turns
    ));
    Ok(crate::common::messages::failure(
        code,
        json!({"used":used,"limit":limit}),
        format!("{diagnostic}: {used}/{limit}"),
    ))
}
