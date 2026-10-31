use super::{
    review_actions::{
        deduplicate, update_mr_description, validate_findings, validate_reverted_finding,
    },
    tool_state::ReviewToolState,
};
use crate::core::db::Database;
use crate::features::review::persistence::ReviewDiscussionAction;
use crate::features::review::{context::ReviewContext, ReviewFinding, ReviewRun, ReviewToolCall};
use crate::features::review::{mentions, security};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

/// The outer error aborts the run; an inner error is returned to the model as a tool result.
/// Keep this distinction when moving validation or persistence across this boundary.
pub(super) async fn dispatch_action(
    db: &Database,
    run: &mut ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    call: &ReviewToolCall,
    state: &mut ReviewToolState,
) -> Result<Result<Value, String>, String> {
    if let Err(error) = super::scope::validate_call(state, call) {
        return Ok(Err(error));
    }
    Ok(match call.name.as_str() {
        "update_mr_description" => {
            if state.description_updated {
                Err(crate::common::messages::code("backend.review.mrDescriptionAlreadyGenerated"))
            } else {
                let description = security::redact(call.arguments["description"].as_str().unwrap())
                    .trim()
                    .to_string();
                let complete = {
                    let ctx = context.lock().map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?;
                    ctx.snapshot
                        .changed_files
                        .iter()
                        .all(|path| ctx.complete_diffs.contains(path))
                };
                if !complete {
                    Err("Read every page of every eligible changed file diff, using the supplied initial diff batch or get_diff_batch, before updating the MR description.".into())
                } else if description.is_empty() {
                    Err("The generated MR description is empty after source redaction.".into())
                } else {
                    match update_mr_description(db, run, context, &description).await {
                        Ok(()) => {
                            run.generated_description = Some(description.clone());
                            state.description_updated = true;
                            db.save_review_run(run)?;
                            db.review_event(
                                &run.id,
                                "description_updated",
                                json!({"descriptionBytes":description.len()}),
                            )?;
                            Ok(
                                json!({"updated":true,"message":"The local Virtual MR description was updated. Continue reviewing the supplied diff context, including relationships across files."}),
                            )
                        }
                        Err(error) => Err(error),
                    }
                }
            }
        }
        "create_review_discussion" => {
            let finding: ReviewFinding = serde_json::from_value(call.arguments.clone())
                .map_err(|_| crate::common::messages::failure("backend.review.inlineFindingMalformed", serde_json::json!({}), "Malformed inline review finding".into()))?;
            match validate_findings(context, vec![finding.clone()]).await {
                Ok(()) => {
                    let mut candidate = state.pending_findings.clone();
                    candidate.push(finding);
                    let candidate = deduplicate(candidate);
                    if candidate.len() > 50 {
                        Err(crate::common::messages::code("backend.review.tooManyFindings"))
                    } else {
                        state.pending_findings = candidate;
                        run.findings = state.pending_findings.clone();
                        db.save_review_run(run)?;
                        Ok(
                            json!({"queued":true,"message":"The inline discussion will be committed with the final review."}),
                        )
                    }
                }
                Err(error) => Err(error),
            }
        }
        "list_open_discussions" => {
            let offset = call.arguments["offset"].as_u64().unwrap_or(0) as usize;
            super::discussions::list(db, run, state, context, offset)
        }
        "read_discussion_comment" => {
            super::discussions::read_comment(db, run, state, context, call)
        }
        "reply_to_discussion" => {
            let discussion_id = call.arguments["discussionId"].as_str().unwrap().to_owned();
            let body = security::redact(call.arguments["body"].as_str().unwrap());
            let discussion = super::discussions::observed(db, run, state, call)?;
            match discussion {
                Err(error) => Err(error),
                Ok(_) if state.replied_discussions.contains(&discussion_id) || state.resolved_discussions.contains(&discussion_id) => {
                    Err(crate::common::messages::code("backend.review.discussionActionQueued"))
                }
                Ok(discussion) if discussion.comments.last().is_none_or(|comment| !mentions::can_reply_to_comment(
                    &db.conn(), &run.session_id, run.reviewer_id.as_deref(), &comment.author_type, &comment.author_id, &comment.body,
                )) => {
                    Err("Reply requires the latest unanswered user comment or a direct mention from another AI reviewer".into())
                }
                Ok(discussion) => {
                    state.replied_discussions.insert(discussion_id.clone());
                    let target_comment_id = discussion.comments.last().unwrap().id.clone();
                    let discussion_revision = call.arguments["discussionRevision"].as_str().unwrap().to_owned();
                    state.pending_discussion_actions.push(ReviewDiscussionAction::Reply { discussion_id, target_comment_id, discussion_revision, body });
                    Ok(json!({"queued":true,"message":"The reply will be posted when this review finishes."}))
                }
            }
        }
        "resolve_discussion" => {
            let discussion_id = call.arguments["discussionId"].as_str().unwrap().to_owned();
            if state.resolved_discussions.contains(&discussion_id)
                || state.replied_discussions.contains(&discussion_id)
            {
                Err("This discussion already has a queued AI action in this review".into())
            } else {
                let discussion = super::discussions::observed(db, run, state, call)?;
                match discussion {
                    Err(error) => Err(error),
                    Ok(discussion) => {
                        let target_comment_id =
                            discussion.comments.last().map(|comment| comment.id.clone());
                        let file_path = call.arguments["filePath"].as_str().unwrap().to_owned();
                        let side = call.arguments["side"].as_str().unwrap().to_owned();
                        let start_line = call.arguments["startLine"].as_u64().unwrap() as usize;
                        let end_line = call.arguments["endLine"].as_u64().unwrap() as usize;
                        let evidence = call.arguments["evidence"].as_str().unwrap().to_owned();
                        let body = security::redact(call.arguments["body"].as_str().unwrap());
                        let original_commit_id = discussion.commit_id.clone();
                        let original_side = discussion.diff_side.clone();
                        if side != "head" {
                            Err("Resolution evidence must use the current head, never the base side".into())
                        } else if let Some(target_comment_id) = target_comment_id {
                            if discussion.file_path.as_deref() != Some(file_path.as_str()) {
                                Err("Resolution evidence must refer to the discussion's file"
                                    .into())
                            } else {
                                let proof = ReviewFinding {
                                    file_path: file_path.clone(),
                                    side: side.clone(),
                                    start_line,
                                    end_line,
                                    severity: "low".into(),
                                    title: "Fix verification evidence".into(),
                                    body: body.clone(),
                                    evidence: evidence.clone(),
                                };
                                let changed = match original_commit_id.as_deref() {
                                    Some(original) => super::review_actions::validate_resolution_change(context, &file_path, original).await,
                                    None => Err("The original finding snapshot is unavailable; leave this discussion open for manual resolution".into()),
                                };
                                let validation = match changed {
                                    Err(error) => Err(error),
                                    Ok(()) => match validate_findings(context, vec![proof.clone()])
                                        .await
                                    {
                                        Ok(()) => Ok(None),
                                        Err(changed_line_error)
                                            if side == "head"
                                                && original_side.as_deref() == Some("right")
                                                && discussion.comments.first().is_some_and(
                                                    |comment| comment.author_type == "ai_agent",
                                                ) =>
                                        {
                                            match original_commit_id.as_deref() {
                                                Some(original_sha) => validate_reverted_finding(
                                                    context,
                                                    proof,
                                                    original_sha.to_owned(),
                                                    "right".to_owned(),
                                                )
                                                .await
                                                .map(|()| Some(original_sha.to_owned())),
                                                None => Err(changed_line_error),
                                            }
                                        }
                                        Err(error) => Err(error),
                                    },
                                };
                                match validation {
                                    Ok(reverted_commit_id) => {
                                        state.resolved_discussions.insert(discussion_id.clone());
                                        state.pending_discussion_actions.push(
                                            ReviewDiscussionAction::Resolve {
                                                discussion_id,
                                                target_comment_id,
                                                discussion_revision: call.arguments
                                                    ["discussionRevision"]
                                                    .as_str()
                                                    .unwrap()
                                                    .to_owned(),
                                                file_path,
                                                side,
                                                start_line,
                                                end_line,
                                                evidence,
                                                body,
                                                reverted_commit_id,
                                            },
                                        );
                                        Ok(
                                            json!({"queued":true,"message":"The resolution and evidence reply will be committed when this review finishes."}),
                                        )
                                    }
                                    Err(error) => Err(error),
                                }
                            }
                        } else {
                            Err(crate::common::messages::code("backend.review.noCommentToResolve"))
                        }
                    }
                }
            }
        }
        _ => {
            let context = Arc::clone(context);
            let name = call.name.clone();
            let args = call.arguments.clone();
            tauri::async_runtime::spawn_blocking(move || {
                context
                    .lock()
                    .map_err(|_| crate::common::messages::failure("backend.review.contextUnavailable", serde_json::json!({}), "Review context unavailable".into()))?
                    .execute(&name, &args)
            })
            .await
            .map_err(|_| crate::common::messages::failure("backend.review.reviewToolTaskFailed", serde_json::json!({}), "Review tool task failed".into()))?
        }
    })
}
