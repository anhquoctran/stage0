//! A mention permits consideration, never an obligation to publish a reply.
use super::tool_state::ReviewToolState;
use crate::{
    core::db::Database,
    features::review::{discussion_reply, discussion_revision, ReviewRun},
};

/// Returns true for a deliberate no-reply completion after complete, fresh context.
pub(super) fn validate(
    db: &Database,
    run: &ReviewRun,
    state: &ReviewToolState,
) -> Result<bool, String> {
    let Some(id) = state.reply_discussion_id.as_deref() else {
        return Ok(false);
    };
    if state.replied_discussions.contains(id) {
        return Ok(false);
    }
    let thread = db
        .list_discussions(&run.session_id)
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|thread| thread.id == id && !thread.is_resolved)
        .ok_or("The assigned discussion is no longer open")?;
    let latest = thread
        .comments
        .last()
        .ok_or("Read the assigned discussion before finishing")?;
    state
        .observations
        .get(id)
        .ok_or("Read the assigned discussion before deciding no reply is needed")?
        .validate(&discussion_revision::of(&thread), &latest.id)?;
    if !discussion_reply::can_reply(&db.conn(), &run.session_id, run.reviewer_id.as_deref(), id) {
        return Err("The latest comment no longer addresses this assigned reviewer".into());
    }
    Ok(true)
}
