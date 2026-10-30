use super::tool_state::ReviewToolState;
use crate::{
    core::db::Database,
    features::review::{mentions, ReviewRequest, ReviewToolCall},
};

pub(crate) fn validate_request(db: &Database, config: &ReviewRequest) -> Result<(), String> {
    if config.instructions.len() > 8000 {
        return Err(crate::common::messages::code("backend.review.instructionsTooLong"));
    }
    if let Some(id) = config.reply_discussion_id.as_deref() {
        let reviewer = config
            .reviewer_id
            .as_deref()
            .ok_or("Discussion replies require an assigned reviewer")?;
        let assigned: bool = db.conn().query_row("SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)", [&config.session_id, reviewer], |row| row.get(0)).map_err(|e| e.to_string())?;
        if !assigned {
            return Err(crate::common::messages::code("backend.review.reviewerUnassigned"));
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
    if let Some(id) = config.manual_review_discussion_id.as_deref() {
        validate_manual_review_request(db, config, id)?;
    }
    Ok(())
}

fn validate_manual_review_request(
    db: &Database,
    config: &ReviewRequest,
    discussion_id: &str,
) -> Result<(), String> {
    let reviewer_id = config
        .reviewer_id
        .as_deref()
        .ok_or("Manual full reviews require an assigned reviewer")?;
    if discussion_id.is_empty()
        || discussion_id.len() > 200
        || config.reply_discussion_id.is_some()
        || config.generate_description
    {
        return Err("Invalid manual full-review request".into());
    }
    let conn = db.conn();
    let reviewer_name: String = conn
        .query_row(
            "SELECT agent_name FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2",
            [&config.session_id, reviewer_id],
            |row| row.get(0),
        )
        .map_err(|_| "This reviewer is no longer assigned to the Virtual MR")?;
    if config
        .reviewer_name
        .as_deref()
        .is_some_and(|name| name != reviewer_name)
    {
        return Err("Manual review reviewer identity does not match the assigned bot".into());
    }
    let (session_id, file_path, is_resolved): (String, Option<String>, bool) = conn
        .query_row(
            "SELECT session_id,file_path,is_resolved FROM virtual_mr_discussions WHERE id=?1",
            [discussion_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Manual review request discussion was not found")?;
    if session_id != config.session_id || file_path.is_some() || is_resolved {
        return Err("Manual review requests must use a new, open MR-level discussion".into());
    }
    let (author_type, body): (String, String) = conn
        .query_row(
            "SELECT author_type,body FROM virtual_mr_comments WHERE discussion_id=?1 ORDER BY rowid LIMIT 1",
            [discussion_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Manual review request has no root comment")?;
    if author_type != "user"
        || !mentions::is_manual_review_command(&body)
        || !mentions::has_reviewer_mention(&body, reviewer_id)
    {
        return Err("Manual review request must be the exact assigned-bot mention command".into());
    }
    let unresolved: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT d.id) FROM virtual_mr_discussions d JOIN virtual_mr_comments c ON c.discussion_id=d.id WHERE d.session_id=?1 AND d.is_resolved=0 AND d.file_path IS NOT NULL AND d.id<>?2 AND c.author_type='ai_agent' AND (c.author_id=?3 OR c.author_name=?4)",
            rusqlite::params![config.session_id, discussion_id, reviewer_id, format!("Stage0 AI ({reviewer_name})")],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if unresolved > 0 {
        return Err(format!(
            "Resolve the {unresolved} open code discussion(s) from this reviewer before starting another review"
        ));
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
