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
    let next_offset = if end < ids.len() { Some(end) } else { None };
    let candidates = ids
        .get(offset..end)
        .unwrap_or_default()
        .iter()
        .map(|id| feedback::thread(db, id))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .filter(|d| feedback::candidate_eligible(d, run.reviewer_id.as_deref()))
        .collect::<Vec<_>>();
    let threads: Vec<_> = candidates
        .iter()
        .map(|d| {
            let root = &d.comments[0];
            let human = d
                .comments
                .iter()
                .rev()
                .find(|c| c.author_type == "user")
                .unwrap();
            json!({"id":d.id,"filePath":d.file_path,"discussionRevision":discussion_revision::of(d),
            "rootCommentId":root.id,"targetCommentId":human.id,"isResolved":d.is_resolved,
            "comments":[present(root,0,600),present(human,0,600)]})
        })
        .collect();
    let value = context
        .lock()
        .map_err(|_| "Review context unavailable")?
        .deliver_external(
            "list_review_feedback",
            json!({"threads":threads,"nextOffset":next_offset}),
        )?;
    for thread in value["threads"].as_array().unwrap() {
        let mut observation = DiscussionObservation::new(
            thread["discussionRevision"].as_str().unwrap().into(),
            thread["rootCommentId"].as_str().unwrap().into(),
            thread["targetCommentId"].as_str().unwrap().into(),
        );
        for comment in thread["comments"].as_array().unwrap() {
            record(&mut observation, comment);
        }
        state
            .feedback_observations
            .insert(thread["id"].as_str().unwrap().into(), observation);
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
    }
    if can_learn {
        registry.enable_feedback();
    }
    Ok(())
}
