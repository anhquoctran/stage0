//! Direct addressing is required independently of thread ownership.
use super::mentions;
use rusqlite::Connection;

/// Bare mentions and punctuation carry no question for the model to assess.
fn has_content(body: &str) -> bool {
    let mut remaining = body.to_owned();
    let mut offset = 0;
    while let Some(start) = remaining[offset..].find("[@").map(|at| at + offset) {
        let Some(link) = remaining[start..].find("](#mr-mention/reviewer/") else {
            break;
        };
        let Some(end) = remaining[start + link..].find(')') else {
            break;
        };
        remaining.replace_range(start..start + link + end + 1, "");
        offset = start;
    }
    remaining.chars().any(char::is_alphanumeric)
}

/// Shared admission, listing, staging and transactional publication gate.
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
    let latest = conn.query_row(
        "SELECT c.author_type,c.author_id,c.body FROM virtual_mr_discussions d
         JOIN virtual_mr_comments c ON c.rowid=(SELECT MAX(latest.rowid) FROM virtual_mr_comments latest WHERE latest.discussion_id=d.id)
         WHERE d.id=?1 AND d.session_id=?2 AND d.is_resolved=0",
        [discussion_id, session_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
    );
    let Ok((kind, author_id, body)) = latest else {
        return false;
    };
    has_content(&body)
        && mentions::has_reviewer_mention(&body, reviewer_id)
        && mentions::can_reply_to_comment(
            conn,
            session_id,
            Some(reviewer_id),
            &kind,
            &author_id,
            &body,
        )
}
