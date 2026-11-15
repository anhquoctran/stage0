//! Memory classification uses independently observed human feedback, never reply permissions.
use super::{
    discussion_observation::DiscussionObservation,
    discussions::{present, record},
    tool_state::ReviewToolState,
};
use crate::{
    core::db::Database,
    features::review::{
        context::ReviewContext, discussion_revision, feedback, ReviewRun, ReviewToolCall,
    },
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

pub(super) fn list(
    db: &Database,
    run: &ReviewRun,
    state: &mut ReviewToolState,
    context: &Arc<Mutex<ReviewContext>>,
    offset: usize,
) -> Result<Value, String> {
    if offset >= 1000 {
        let cursor = offset - 1000;
        list_page(db, run, state, context, cursor / 64, cursor % 64)
    } else {
        list_page(db, run, state, context, offset, 0)
    }
}

pub(super) fn list_page(
    db: &Database,
    run: &ReviewRun,
    state: &mut ReviewToolState,
    context: &Arc<Mutex<ReviewContext>>,
    offset: usize,
    comment_offset: usize,
) -> Result<Value, String> {
    if state.feedback_candidates.is_none() {
        state.feedback_candidates = Some(
            feedback::candidates(db, run)?
                .into_iter()
                .map(|t| t.id)
                .collect(),
        );
    }
    let ids = state.feedback_candidates.as_ref().unwrap();
    let end = offset.saturating_add(2).min(ids.len());
    let mut candidates = ids
        .get(offset..end)
        .unwrap_or_default()
        .iter()
        .map(|id| feedback::thread(db, id))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .filter(|d| feedback::candidate_eligible(d, run.reviewer_id.as_deref()))
        .collect::<Vec<_>>();
    if candidates
        .iter()
        .any(|d| feedback::learning_history(d).len() > 2)
        || comment_offset > 0
    {
        candidates.truncate(1);
    }
    let next = candidates
        .last()
        .and_then(|d| ids.iter().position(|id| id == &d.id))
        .map(|i| i + 1)
        .unwrap_or(end);
    let mut next_offset = (next < ids.len()).then_some(next);
    let mut threads = Vec::new();
    for d in &candidates {
        let history = feedback::learning_history(d);
        if comment_offset >= history.len() {
            return Err("Feedback history offset is outside the conversation".into());
        }
        let end = comment_offset.saturating_add(6).min(history.len());
        if end < history.len() {
            let index = ids.iter().position(|id| id == &d.id).unwrap();
            next_offset = Some(1000 + index * 64 + end);
        }
        let root = &d.comments[0];
        let human = history.last().unwrap();
        threads.push(json!({"id":d.id,"filePath":d.file_path,"discussionRevision":discussion_revision::of(d),
            "rootCommentId":root.id,"targetCommentId":human.id,"isResolved":d.is_resolved,
            "commentOffset":comment_offset,"totalComments":history.len(),
            "comments":history[comment_offset..end].iter().map(|c|present(c,0,600)).collect::<Vec<_>>() }));
    }
    let value = context
        .lock()
        .map_err(|_| "Review context unavailable")?
        .deliver_external(
            "list_review_feedback",
            json!({"threads":threads,"nextOffset":next_offset}),
        )?;
    for thread in value["threads"].as_array().unwrap() {
        let id = thread["id"].as_str().unwrap();
        let revision = thread["discussionRevision"].as_str().unwrap();
        let root = thread["rootCommentId"].as_str().unwrap();
        let target = thread["targetCommentId"].as_str().unwrap();
        let observation = state
            .feedback_observations
            .entry(id.into())
            .or_insert_with(|| {
                DiscussionObservation::new(revision.into(), root.into(), target.into())
            });
        if observation.revision != revision || observation.target_id != target {
            *observation = DiscussionObservation::new(revision.into(), root.into(), target.into());
        }
        let original = candidates.iter().find(|d| d.id == id).unwrap();
        observation.require(
            feedback::learning_history(original)
                .iter()
                .map(|c| c.id.clone()),
        );
        for comment in thread["comments"].as_array().unwrap() {
            record(observation, comment);
        }
    }
    Ok(value)
}

pub(super) fn classify(
    db: &Database,
    run: &ReviewRun,
    state: &ReviewToolState,
    call: &ReviewToolCall,
) -> Result<Value, String> {
    let args = &call.arguments;
    let id = args["discussionId"].as_str().unwrap();
    state
        .feedback_observations
        .get(id)
        .ok_or("Read review feedback before classifying it")?
        .validate(
            args["discussionRevision"].as_str().unwrap(),
            args["targetCommentId"].as_str().unwrap(),
        )?;
    feedback::tools::classify(db, run, call)
}

/// Source/evidence contexts do not acquire memory tools unless enabled by the host.
pub(super) fn configure(
    db: &Database,
    run: &ReviewRun,
    context: &Arc<Mutex<ReviewContext>>,
    registry: &mut crate::features::review::tool_registry::ReviewToolRegistry,
    initial: &mut Value,
    system: &mut String,
) -> Result<(), String> {
    if !context
        .lock()
        .map(|ctx| ctx.feedback_enabled)
        .unwrap_or(false)
    {
        return Ok(());
    }
    let (notes, can_learn) = feedback::tools::prepare(db, run, context)?;
    if !notes.is_null() {
        initial["reviewFeedback"] = notes;
        system.push_str("\n\nHuman review feedback:\n");
        system.push_str(feedback::POLICY);
    } else {
        system.push_str("\nPersistent memory requires an available classify_review_feedback tool and a successful save result. No memory write tool is available in this run; do not claim you saved a preference. Ask for a new, concise directly addressed discussion if teaching context is unavailable or too long.");
    }
    if can_learn {
        registry.enable_feedback();
    }
    Ok(())
}
