use super::tool_state::ReviewToolState;
use crate::{
    core::db::Database,
    features::review::{mentions, ReviewRequest, ReviewToolCall},
};

pub(crate) fn validate_request(db: &Database, config: &ReviewRequest) -> Result<(), String> {
    if config.instructions.len() > 8000 {
        return Err("Reviewer instructions exceed the 8000-byte limit".into());
    }
    if let Some(id) = config.reply_discussion_id.as_deref() {
        let reviewer = config
            .reviewer_id
            .as_deref()
            .ok_or("Discussion replies require an assigned reviewer")?;
        let assigned: bool = db.conn().query_row("SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)", [&config.session_id, reviewer], |row| row.get(0)).map_err(|e| e.to_string())?;
        if !assigned {
            return Err("This reviewer is no longer assigned to the Virtual MR".into());
        }
        if id.is_empty() || id.len() > 200 || config.generate_description {
            return Err(
                "A discussion reply must name one thread and cannot generate an MR description"
                    .into(),
            );
        }
        let thread = db
            .list_discussions(&config.session_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|d| d.id == id && !d.is_resolved)
            .ok_or("Open discussion not found in this Virtual MR")?;
        let latest = thread
            .comments
            .last()
            .ok_or("The discussion has no comment")?;
        if !mentions::can_reply_to_comment(
            &db.conn(),
            &config.session_id,
            config.reviewer_id.as_deref(),
            &latest.author_type,
            &latest.author_id,
            &latest.body,
        ) {
            return Err("This comment is not addressed to the selected reviewer".into());
        }
    }
    Ok(())
}

pub(super) fn configure(
    db: &Database,
    config: &ReviewRequest,
    state: &mut ReviewToolState,
) -> Result<(), String> {
    validate_request(db, config)?;
    state.reply_discussion_id = config.reply_discussion_id.clone();
    if let Some(id) = config.reply_discussion_id.as_deref() {
        state.reply_file_path = db
            .list_discussions(&config.session_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|d| d.id == id)
            .and_then(|d| d.file_path);
    }
    Ok(())
}

pub(super) fn validate_call(state: &ReviewToolState, call: &ReviewToolCall) -> Result<(), String> {
    if let Some(id) = state.reply_discussion_id.as_deref() {
        if !matches!(
            call.name.as_str(),
            "list_open_discussions"
                | "read_discussion_comment"
                | "get_file_diff"
                | "read_file_range"
                | "reply_to_discussion"
                | "submit_review"
        ) {
            return Err("This tool is not authorized in a discussion-reply-only run".into());
        }
        if let Some(target) = call.arguments["discussionId"].as_str() {
            if target != id {
                return Err("This reply run can access only its assigned discussion".into());
            }
        }
        if let Some(path) = call.arguments["filePath"].as_str() {
            if state.reply_file_path.as_deref() != Some(path) {
                return Err("This reply run can read only the discussion's file".into());
            }
        }
        if call.name == "submit_review"
            && (call.arguments["decision"] != "comment"
                || call.arguments["findings"]
                    .as_array()
                    .is_none_or(|items| !items.is_empty()))
        {
            return Err("A discussion reply can submit only comment with no findings; it cannot decide an MR verdict".into());
        }
    }
    Ok(())
}
