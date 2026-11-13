//! Thread ownership is required in addition to comment-level addressing.
use super::mentions;
use rusqlite::Connection;
use serde_json::Value;

/// Used at admission, context delivery, staging and transactional publication.
/// Read persisted root provenance rather than inferring ownership from replies.
pub(super) fn can_reply(
    conn: &Connection,
    session_id: &str,
    reviewer_id: Option<&str>,
    discussion_id: &str,
) -> bool {
    let Some(reviewer_id) = reviewer_id else {
        return false;
    };
    let assigned = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)",
        [session_id, reviewer_id], |row| row.get::<_, bool>(0),
    ).unwrap_or(false);
    if !assigned {
        return false;
    }
    let thread = conn.query_row(
        "SELECT root.author_type,root.author_id,latest.author_type,latest.author_id,latest.body
         FROM virtual_mr_discussions d
         JOIN virtual_mr_comments root ON root.rowid=(SELECT MIN(c.rowid) FROM virtual_mr_comments c WHERE c.discussion_id=d.id)
         JOIN virtual_mr_comments latest ON latest.rowid=(SELECT MAX(c.rowid) FROM virtual_mr_comments c WHERE c.discussion_id=d.id)
         WHERE d.id=?1 AND d.session_id=?2 AND d.is_resolved=0",
        [discussion_id, session_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?,
            row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?)),
    );
    let Ok((root_type, root_id, latest_type, latest_id, body)) = thread else {
        return false;
    };
    if !mentions::can_reply_to_comment(
        conn,
        session_id,
        Some(reviewer_id),
        &latest_type,
        &latest_id,
        &body,
    ) {
        return false;
    }
    if latest_type != "user" || mentions::has_reviewer_mention(&body, reviewer_id) {
        return true;
    }
    // An unaddressed human followup belongs only to this finding's original bot.
    if root_type != "ai_agent" {
        return false;
    }
    if root_id == reviewer_id {
        return true;
    }
    // Historical AI comments stored the review run ID instead of reviewer ID.
    conn.query_row(
        "SELECT payload FROM ai_review_runs WHERE id=?1 AND session_id=?2",
        [&root_id, session_id],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|payload| serde_json::from_str::<Value>(&payload).ok())
    .is_some_and(|run| run["reviewerId"].as_str() == Some(reviewer_id))
}
