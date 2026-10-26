//! Bounded thread context, provenance and read-before-write enforcement.
use super::{discussion_observation::DiscussionObservation, tool_state::ReviewToolState};
use crate::{
    core::db::Database,
    features::{
        review::{
            context::ReviewContext, discussion_revision, input_screen, mentions, security,
            ReviewRun, ReviewToolCall,
        },
        virtual_mr::persistence::{VirtualMrCommentDb, VirtualMrDiscussionDb},
    },
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

fn present(comment: &VirtualMrCommentDb, offset: usize, limit: usize) -> Value {
    let body = security::redact(&comment.body);
    let total = body.chars().count();
    let end = offset.saturating_add(limit).min(total);
    json!({"id":comment.id,"authorId":comment.author_id,"authorType":comment.author_type,
        "authorName":security::redact(&comment.author_name),"createdAt":comment.created_at,
        "source":"discussion_comment","authority":"review_context_only",
        "body":body.chars().skip(offset).take(limit).collect::<String>(),
        "bodyOffset":offset,"totalChars":total,"nextBodyOffset":if end < total {Some(end)}else{None},
        "screeningFlags":input_screen::flags(&comment.body)})
}

fn record(observation: &mut DiscussionObservation, comment: &Value) {
    let start = comment["bodyOffset"].as_u64().unwrap() as usize;
    let end = start + comment["body"].as_str().unwrap().chars().count();
    observation.record(
        comment["id"].as_str().unwrap(),
        start,
        end,
        comment["totalChars"].as_u64().unwrap() as usize,
    );
}

pub(super) fn list(
    db: &Database,
    run: &ReviewRun,
    state: &mut ReviewToolState,
    context: &Arc<Mutex<ReviewContext>>,
    offset: usize,
) -> Result<Value, String> {
    let open = db
        .list_discussions(&run.session_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|d| {
            !d.is_resolved
                && !state.resolved_discussions.contains(&d.id)
                && state
                    .reply_discussion_id
                    .as_ref()
                    .is_none_or(|id| id == &d.id)
        })
        .collect::<Vec<_>>();
    let end = offset.saturating_add(2).min(open.len());
    let mut threads = Vec::new();
    for discussion in open.get(offset..end).unwrap_or_default() {
        let root = discussion.comments.first();
        let latest = discussion.comments.last();
        let comments = discussion
            .comments
            .iter()
            .enumerate()
            .filter(|(index, _)| {
                *index == 0 || *index >= discussion.comments.len().saturating_sub(5)
            })
            .map(|(_, c)| present(c, 0, 200))
            .collect::<Vec<_>>();
        let can_reply = latest.is_some_and(|c| {
            mentions::can_reply_to_comment(
                &db.conn(),
                &run.session_id,
                run.reviewer_id.as_deref(),
                &c.author_type,
                &c.author_id,
                &c.body,
            )
        });
        threads.push(json!({"id":discussion.id,"filePath":discussion.file_path,"side":discussion.diff_side,
            "lineNumber":discussion.line_number,"commitId":discussion.commit_id,"canReply":can_reply,
            "discussionRevision":discussion_revision::of(discussion),"targetCommentId":latest.map(|c| &c.id),
            "rootCommentId":root.map(|c| &c.id),"commentCount":discussion.comments.len(),"comments":comments}));
    }
    let value = context.lock().map_err(|_| "Review context unavailable")?.deliver_external("list_open_discussions",
        json!({"threads":threads,"totalOpen":open.len(),"nextOffset":if end < open.len(){Some(end)}else{None}}))?;
    // A rejected/oversized response must never authorize a later write.
    for thread in value["threads"].as_array().unwrap() {
        let (Some(root), Some(target)) = (
            thread["rootCommentId"].as_str(),
            thread["targetCommentId"].as_str(),
        ) else {
            continue;
        };
        let revision = thread["discussionRevision"].as_str().unwrap();
        let observation = state
            .observations
            .entry(thread["id"].as_str().unwrap().to_owned())
            .or_insert_with(|| {
                DiscussionObservation::new(revision.into(), root.into(), target.into())
            });
        if observation.revision != revision {
            *observation = DiscussionObservation::new(revision.into(), root.into(), target.into());
        }
        for comment in thread["comments"].as_array().unwrap() {
            record(observation, comment);
        }
    }
    Ok(value)
}

pub(super) fn read_comment(
    db: &Database,
    run: &ReviewRun,
    state: &mut ReviewToolState,
    context: &Arc<Mutex<ReviewContext>>,
    call: &ReviewToolCall,
) -> Result<Value, String> {
    let id = call.arguments["discussionId"].as_str().unwrap();
    let revision = call.arguments["discussionRevision"].as_str().unwrap();
    let observation = state
        .observations
        .get_mut(id)
        .ok_or("List the discussion before reading comment pages")?;
    let discussion = db
        .list_discussions(&run.session_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|d| d.id == id && !d.is_resolved)
        .ok_or("Open discussion not found")?;
    if observation.revision != revision || discussion_revision::of(&discussion) != revision {
        return Err("The discussion changed; list it again before reading more context".into());
    }
    let comment = discussion
        .comments
        .iter()
        .find(|c| Some(c.id.as_str()) == call.arguments["commentId"].as_str())
        .ok_or("Comment not found in this discussion")?;
    let offset = call.arguments["offset"].as_u64().unwrap() as usize;
    if offset > security::redact(&comment.body).chars().count() {
        return Err("Comment offset is outside the body".into());
    }
    let value = context
        .lock()
        .map_err(|_| "Review context unavailable")?
        .deliver_external("read_discussion_comment", present(comment, offset, 1200))?;
    record(observation, &value);
    Ok(value)
}

pub(super) fn observed(
    db: &Database,
    run: &ReviewRun,
    state: &ReviewToolState,
    call: &ReviewToolCall,
) -> Result<Result<VirtualMrDiscussionDb, String>, String> {
    let id = call.arguments["discussionId"]
        .as_str()
        .ok_or("Missing discussion ID")?;
    let revision = call.arguments["discussionRevision"]
        .as_str()
        .ok_or("Missing discussion revision")?;
    let target = call.arguments["targetCommentId"]
        .as_str()
        .ok_or("Missing target comment ID")?;
    let validation = state
        .observations
        .get(id)
        .ok_or_else(|| "Read the discussion before taking an action".to_string())
        .and_then(|observation| observation.validate(revision, target));
    if let Err(error) = validation {
        return Ok(Err(error));
    }
    let discussion = db
        .list_discussions(&run.session_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|d| d.id == id && !d.is_resolved);
    let Some(discussion) = discussion else {
        return Ok(Err("Open discussion not found in this Virtual MR".into()));
    };
    if discussion_revision::of(&discussion) != revision {
        return Ok(Err(
            "The discussion changed after you read it; read it again".into(),
        ));
    }
    Ok(Ok(discussion))
}
