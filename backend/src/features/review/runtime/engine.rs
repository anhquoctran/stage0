use super::{
    prompt::build_system_prompt, tool_state::ReviewToolState, tool_turn::execute_tool_calls,
};
use crate::core::db::Database;
use crate::features::review::{
    context::ReviewContext, model_adapter::ReviewModelAdapter, tool_registry::ReviewToolRegistry,
    ReviewRequest, ReviewRetryState, ReviewRun,
};
use crate::features::review::{debug_log, mentions};
use serde_json::json;
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};

pub(super) const MAX_REQUEST_BYTES: usize = 160 * 1024;
pub(super) const MAX_REVIEW_WIRE_BYTES: usize = 512 * 1024;

pub(super) const MAX_REVIEW_TURNS: usize = 128;
pub(super) const MAX_REVIEW_TOOL_CALLS: usize = 256;
pub(super) const MAX_DECODE_RECOVERIES: usize = 2;
pub(super) const MAX_PROVIDER_RETRIES: usize = 2;

pub(super) async fn execute_with_adapter(
    db: &Database,
    config: &ReviewRequest,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    adapter: &dyn ReviewModelAdapter,
) -> Result<(), String> {
    super::scope::validate_request(db, config)?;
    run.reply_discussion_id = config.reply_discussion_id.clone();
    let reply_only = config.reply_discussion_id.is_some();
    let max_turns = if reply_only { 16 } else { MAX_REVIEW_TURNS };
    let max_calls = if reply_only {
        24
    } else {
        MAX_REVIEW_TOOL_CALLS
    };
    let token_limit = if reply_only { 32_000 } else { 64_000 };
    let wire_limit = if reply_only {
        384 * 1024
    } else {
        MAX_REVIEW_WIRE_BYTES
    };
    if reply_only {
        context
            .lock()
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.contextUnavailable",
                    serde_json::json!({}),
                    "Review context unavailable".into(),
                )
            })?
            .max_bytes = 32 * 1024;
    }
    let system = build_system_prompt(config);
    let (mr_title, target_branch, source_branch) = {
        let conn = db.conn();
        conn.query_row(
            "SELECT title,base_branch,compare_branch FROM virtual_mr_sessions WHERE id=?1",
            [&run.session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .map_err(|_| {
            crate::common::messages::failure(
                "backend.review.virtualMrNoLongerExists",
                serde_json::json!({}),
                "Virtual MR no longer exists".into(),
            )
        })?
    };
    let participants = mentions::participants(&db.conn(), &run.session_id)?;
    let prompt=json!({"task":"Review this Virtual MR snapshot. Compare the source branch with the target branch, inspect unresolved discussions, publish evidence-backed inline findings, reply to users or AI peers who directly mention you when needed, and resolve only verified fixes", "mrTitle":mr_title,"targetBranch":target_branch,"sourceBranch":source_branch,"reviewerId":run.reviewer_id,"participants":participants,"baseSha":run.snapshot.base_sha,"headSha":run.snapshot.head_sha,"mergeBaseSha":run.snapshot.merge_base_sha,"changedFileCount":run.snapshot.changed_files.len(),"excludedFileCount":run.snapshot.excluded_files.len()}).to_string();
    let mut initial: serde_json::Value = serde_json::from_str(&prompt).map_err(|_| {
        crate::common::messages::failure(
            "backend.review.buildContextFailed",
            serde_json::json!({}),
            "Could not build review context".into(),
        )
    })?;
    initial["reviewPreferences"] = super::prompt::review_preferences(config);
    initial["replyDiscussionId"] = json!(config.reply_discussion_id);
    if reply_only {
        initial["task"] = json!("Answer the latest eligible comment in the assigned discussion. This is not an MR review or approval.");
    }
    let registry = ReviewToolRegistry::for_request(config);
    let tools = registry.definitions();
    let mut wire_bytes = 0usize;
    let mut recovered_missing_tool_call = false;
    let mut decode_recoveries = 0;
    let mut provider_retries = 0;
    let mut state = ReviewToolState::new(config.generate_description);
    super::scope::configure(db, config, &mut state)?;
    let has_open_discussions = db
        .list_discussions(&run.session_id)
        .map_err(|error| error.to_string())?
        .iter()
        .any(|discussion| !discussion.is_resolved);
    if run.snapshot.changed_files.is_empty() && !has_open_discussions {
        if run.snapshot.excluded_files.is_empty() {
            run.summary="No changed files in this snapshot. No model request was needed; no approval was recorded.".into();
            run.status = "completed".into();
        } else {
            run.summary = format!(
                "No eligible changed files to review: all {} changed paths were excluded by source policy. No model request was sent and no code was reviewed.",
                run.snapshot.excluded_files.len()
            );
            run.status = "partial".into();
            db.review_event(
                &run.id,
                "no_eligible_files",
                json!({"excludedFileCount":run.snapshot.excluded_files.len()}),
            )?;
        }
        debug_log::log(format_args!(
            "event=review_skipped_no_eligible_work run={} excluded_files={} model_requests=0",
            debug_log::safe_label(&run.id, 80),
            run.snapshot.excluded_files.len()
        ));
        return Ok(());
    }
    let (mut history, mut initial_diff) =
        super::initial_context::prepare(context, adapter, &system, &initial, tools, reply_only)
            .await?;
    debug_log::log(format_args!(
        "event=review_context_ready run={} eligible_files={} excluded_files={} open_discussions={} tool_count={} description_generation={}",
        debug_log::safe_label(&run.id, 80),
        run.snapshot.changed_files.len(),
        run.snapshot.excluded_files.len(),
        db.list_discussions(&run.session_id).map(|discussions| discussions.iter().filter(|discussion| !discussion.is_resolved).count()).unwrap_or_default(),
        tools.len(),
        config.generate_description
    ));
    db.review_event(&run.id, "review_preferences_screened", json!({
        "inputBytes":config.instructions.len(),"screeningFlags":super::super::input_screen::flags(&config.instructions),
        "scope":if config.reply_discussion_id.is_some(){"discussion_reply"}else{"mr_review"},
        "executionMode":config.execution_mode,
        "acpOsSandboxed":if config.execution_mode == "acp" { Some(false) } else { None }
    }))?;
    for turn in 0..max_turns {
        run.turns = turn + 1;
        let body = adapter.payload(&system, &history, tools, 2048);
        let bytes = adapter.request_size(&body);
        // Stateless HTTP providers reserve their transport retry. Every ACP
        // continuation, including a delayed provider retry, is counted here.
        wire_bytes =
            wire_bytes.saturating_add(bytes.saturating_mul(adapter.retry_reserve_factor()));
        if bytes > MAX_REQUEST_BYTES || wire_bytes > wire_limit || run.usage_tokens >= token_limit {
            debug_log::log(format_args!(
                "event=review_budget_exhausted run={} turn={} request_bytes={} estimated_wire_bytes={} usage_tokens={}",
                debug_log::safe_label(&run.id, 80),
                run.turns,
                bytes,
                wire_bytes,
                run.usage_tokens
            ));
            return Err(crate::common::messages::failure(
                "backend.review.tokenBudgetExceeded",
                serde_json::json!({}),
                "Review token budget exhausted".to_string(),
            ));
        }
        db.review_event(
            &run.id,
            "model_request",
            json!({"turn":run.turns,"requestBytes":bytes}),
        )?;
        db.save_review_run(run)?;
        debug_log::log(format_args!(
            "event=model_request_started run={} turn={} mode={} provider={} model={} request_bytes={} history_items={} estimated_wire_bytes={}",
            debug_log::safe_label(&run.id, 80),
            run.turns,
            config.execution_mode,
            debug_log::safe_label(&run.provider, 40),
            debug_log::safe_label(&run.model, 100),
            bytes,
            history.len(),
            wire_bytes
        ));
        let request_started = Instant::now();
        let response = match adapter.request(&body).await {
            Ok(response) => response,
            Err(error) => {
                debug_log::log(format_args!(
                    "event=model_request_failed run={} turn={} elapsed_ms={} error_class={}",
                    debug_log::safe_label(&run.id, 80),
                    run.turns,
                    request_started.elapsed().as_millis(),
                    debug_log::error_class(&error)
                ));
                return Err(error);
            }
        };
        if let Some(failure) = adapter.response_failure(&response) {
            db.review_event(&run.id, "agent_failure", json!({
                "turn":run.turns,"kind":failure.kind,"httpStatus":failure.http_status,"retryable":failure.retryable,
            }))?;
            debug_log::log(format_args!(
                "event=agent_provider_failure run={} turn={} kind={} http_status={} retryable={}",
                debug_log::safe_label(&run.id, 80),
                run.turns,
                failure.kind,
                failure.http_status.unwrap_or(0),
                failure.retryable
            ));
            let delay = if provider_retries < MAX_PROVIDER_RETRIES && run.turns < max_turns {
                failure.retry_delay(provider_retries + 1)
            } else {
                None
            };
            let Some(delay) = delay else {
                return Err(failure.message);
            };
            provider_retries += 1;
            let retry_at = (chrono::Utc::now()
                + chrono::Duration::milliseconds(delay.as_millis() as i64))
            .to_rfc3339();
            run.retry = Some(ReviewRetryState {
                reason: failure.kind.into(),
                http_status: failure.http_status,
                attempt: provider_retries,
                max_attempts: MAX_PROVIDER_RETRIES,
                retry_at: retry_at.clone(),
            });
            db.save_review_run(run)?;
            db.review_event(&run.id, "provider_retry_scheduled", json!({
                "turn":run.turns,"reason":failure.kind,"httpStatus":failure.http_status,
                "attempt":provider_retries,"maxAttempts":MAX_PROVIDER_RETRIES,"delayMs":delay.as_millis(),"retryAt":retry_at,
            }))?;
            debug_log::log(format_args!(
                "event=provider_retry_scheduled run={} turn={} reason={} http_status={} attempt={} max_attempts={} delay_ms={}",
                debug_log::safe_label(&run.id, 80), run.turns, failure.kind,
                failure.http_status.unwrap_or(0), provider_retries, MAX_PROVIDER_RETRIES, delay.as_millis()
            ));
            // The run's existing deadline and cancellation select still own
            // this wait. No extra request is sent while the timer is pending.
            tokio::time::sleep(delay).await;
            run.retry = None;
            db.save_review_run(run)?;
            adapter.append_request_retry(&mut history);
            continue;
        }
        if let Some(batch) = initial_diff.take() {
            super::initial_context::delivered(db, run, context, batch)?;
        }
        let (calls, usage) = match adapter.decode(&response, &mut history) {
            Ok(decoded) => decoded,
            Err(error) => {
                debug_log::log(format_args!(
                    "event=model_response_decode_failed run={} turn={} elapsed_ms={} response_bytes={} error_class={}",
                    debug_log::safe_label(&run.id, 80),
                    run.turns,
                    request_started.elapsed().as_millis(),
                    response.to_string().len(),
                    debug_log::error_class(&error)
                ));
                if decode_recoveries < MAX_DECODE_RECOVERIES
                    && run.turns < max_turns
                    && adapter.recover_decode_error(&error, &mut history)
                {
                    decode_recoveries += 1;
                    db.review_event(
                        &run.id,
                        "tool_call_retry",
                        json!({"turn":run.turns,"reason":"invalid_tool_call_envelope","attempt":decode_recoveries,"limit":MAX_DECODE_RECOVERIES}),
                    )?;
                    debug_log::log(format_args!(
                        "event=tool_call_recovery_prompt run={} turn={} reason=invalid_tool_call_envelope attempt={} limit={}",
                        debug_log::safe_label(&run.id, 80),
                        run.turns,
                        decode_recoveries,
                        MAX_DECODE_RECOVERIES
                    ));
                    continue;
                }
                return Err(error);
            }
        };
        run.usage_tokens = run.usage_tokens.saturating_add(usage);
        let output_item_types = response["output"]
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .map(|item| match item["type"].as_str() {
                        Some("function_call") => "function_call",
                        Some("message") => "message",
                        Some("reasoning") => "reasoning",
                        Some("refusal") => "refusal",
                        _ => "other",
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let has_refusal = output_item_types.contains(&"refusal")
            || response["output"].as_array().is_some_and(|items| {
                items.iter().any(|item| {
                    item["content"].as_array().is_some_and(|content| {
                        content.iter().any(|block| block["type"] == "refusal")
                    })
                })
            });
        let has_output_text = response["output_text"]
            .as_str()
            .is_some_and(|text| !text.trim().is_empty())
            || response["output"].as_array().is_some_and(|items| {
                items.iter().any(|item| {
                    item["content"].as_array().is_some_and(|content| {
                        content.iter().any(|block| {
                            block["type"] == "output_text"
                                && block["text"]
                                    .as_str()
                                    .is_some_and(|text| !text.trim().is_empty())
                        })
                    })
                })
            });
        db.review_event(
            &run.id,
            "model_response",
            json!({"turn":run.turns,"usageTokens":usage,"toolCalls":calls.len(),"outputItemTypes":output_item_types,"hasOutputText":has_output_text,"hasRefusal":has_refusal,"streamedOutputItems":response["_stage0Stream"]["completedOutputItems"].as_u64(),"terminalOutputItems":response["_stage0Stream"]["terminalOutputItems"].as_u64()}),
        )?;
        debug_log::log(format_args!(
            "event=model_response_received run={} turn={} elapsed_ms={} usage_tokens={} total_usage_tokens={} tool_calls={} output_item_types={} has_output_text={} has_refusal={}",
            debug_log::safe_label(&run.id, 80),
            run.turns,
            request_started.elapsed().as_millis(),
            usage,
            run.usage_tokens,
            calls.len(),
            output_item_types.join(","),
            has_output_text,
            has_refusal
        ));
        if run.usage_tokens > token_limit {
            debug_log::log(format_args!(
                "event=review_budget_exhausted run={} reason=reported_token_limit usage_tokens={} limit=selected_run_budget",
                debug_log::safe_label(&run.id, 80),
                run.usage_tokens
            ));
            return Err(crate::common::messages::failure(
                "backend.review.tokenBudgetExceeded",
                serde_json::json!({}),
                "Review token budget exhausted".to_string(),
            ));
        }
        if calls.is_empty() {
            debug_log::log(format_args!(
                "event=model_response_without_tool_call run={} turn={} has_refusal={} has_output_text={} recovery_available={}",
                debug_log::safe_label(&run.id, 80),
                run.turns,
                has_refusal,
                has_output_text,
                !has_refusal && !recovered_missing_tool_call && run.turns < max_turns
            ));
            if !has_refusal && !recovered_missing_tool_call && run.turns < max_turns {
                let reminder = "Your previous response did not invoke a tool and is not a review result. Continue the sandboxed review now: call one supplied snapshot or discussion tool; do not answer in prose. If the investigation is complete, call submit_review with the summary and findings.";
                if config.execution_mode != "acp" && config.provider == "gemini" {
                    history.push(json!({"role":"user","parts":[{"text":reminder}]}));
                } else {
                    history.push(json!({"role":"user","content":reminder}));
                }
                recovered_missing_tool_call = true;
                db.review_event(
                    &run.id,
                    "tool_call_retry",
                    json!({"turn":run.turns,"reason":"provider_returned_no_tool_call"}),
                )?;
                debug_log::log(format_args!(
                    "event=tool_call_recovery_prompt run={} turn={} reason=missing_tool_call",
                    debug_log::safe_label(&run.id, 80),
                    run.turns
                ));
                continue;
            }
            return Err(crate::common::messages::failure("backend.review.toolUseRequiredNoCall", serde_json::json!({}), "The provider returned no function call although this review requires tool use. The selected model/account may not support required function calling, or the response may have been refused; check the run trace for response type metadata.".into()));
        }
        if run.tool_calls + calls.len() > max_calls {
            debug_log::log(format_args!(
                "event=review_budget_exhausted run={} reason=tool_call_limit current_calls={} requested_calls={} limit={}",
                debug_log::safe_label(&run.id, 80),
                run.tool_calls,
                calls.len(),
                max_calls
            ));
            return Err(crate::common::messages::code(
                "backend.review.toolCallBudgetExceeded",
            ));
        }
        if calls.iter().any(|call| call.name == "submit_review") && calls.len() != 1 {
            debug_log::log(format_args!(
                "event=tool_call_batch_rejected run={} turn={} reason=submit_review_must_be_solo calls={}",
                debug_log::safe_label(&run.id, 80),
                run.turns,
                calls.len()
            ));
            return Err(crate::common::messages::code(
                "backend.review.submitReviewSingleCall",
            ));
        }
        let (submitted, results) =
            execute_tool_calls(db, config, run, context, &mut state, calls, &registry).await?;
        if submitted {
            return Ok(());
        }
        adapter.append_results(&mut history, &results);
    }
    debug_log::log(format_args!(
        "event=review_turn_budget_exhausted run={} turns={} tool_calls={}",
        debug_log::safe_label(&run.id, 80),
        run.turns,
        run.tool_calls
    ));
    Err(crate::common::messages::failure(
        "backend.review.turnBudgetExceeded",
        serde_json::json!({}),
        "Review turn budget exhausted without a final structured result".to_string(),
    ))
}
