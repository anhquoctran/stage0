use crate::features::review::ReviewRun;
use rusqlite::{params, Connection};

pub(super) fn sync_run_state(
    conn: &Connection,
    run: &ReviewRun,
    only_reviewing: bool,
) -> Result<(), rusqlite::Error> {
    // Success verdicts belong exclusively to the guarded publication transaction.
    let status = match run.status.as_str() {
        "running" => "reviewing",
        "failed" | "incomplete" | "interrupted" | "cancelled" => run.status.as_str(),
        _ => return Ok(()),
    };
    let Some(reviewer) = run
        .reviewer_id
        .as_deref()
        .filter(|_| run.reply_discussion_id.is_none())
    else {
        return Ok(());
    };
    conn.execute(
        "UPDATE virtual_mr_session_reviewers SET review_status=?1
         WHERE session_id=?2 AND agent_id=?3 AND (?5=0 OR review_status='reviewing')
         AND NOT EXISTS (
             SELECT 1 FROM ai_review_runs newer
             WHERE newer.session_id=?2 AND newer.rowid>(SELECT rowid FROM ai_review_runs WHERE id=?4)
               AND CASE WHEN json_valid(newer.payload) THEN
                   json_extract(newer.payload,'$.reviewerId')=?3
                   AND json_extract(newer.payload,'$.replyDiscussionId') IS NULL
               ELSE 0 END
         )",
        params![status, run.session_id, reviewer, run.id, only_reviewing],
    )?;
    Ok(())
}

/// Startup already marks unresumable model calls interrupted. Keep assignment badges in sync.
/// Do not overwrite deliberate pending resets, published verdicts, or newer full reviews.
pub(crate) fn recover_reviewer_states(conn: &Connection) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT payload FROM ai_review_runs WHERE status='interrupted'
         AND session_id IN (SELECT session_id FROM virtual_mr_session_reviewers WHERE review_status='reviewing')",
    )?;
    for payload in stmt.query_map([], |row| row.get::<_, String>(0))? {
        if let Ok(mut run) = serde_json::from_str::<ReviewRun>(&payload?) {
            run.status = "interrupted".into();
            sync_run_state(conn, &run, true)?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "reviewer_state_tests.rs"]
mod tests;
