use super::state_reads;
use crate::features::review::ReviewRun;
use rusqlite::{params, Connection};

pub(crate) fn validate_publication(conn: &Connection, run: &ReviewRun) -> Result<(), String> {
    let state = state_reads::one(conn, &run.session_id)?;
    if state.is_some_and(|s| {
        s.session_status == "closed"
            || s.ref_status != "ready"
            || s.base_sha.as_deref() != Some(&run.snapshot.base_sha)
            || s.head_sha.as_deref() != Some(&run.snapshot.head_sha)
    }) {
        return Err(crate::common::messages::code(
            "backend.review.snapshotStale",
        ));
    }
    Ok(())
}

pub(crate) fn complete_review(conn: &Connection, run: &ReviewRun) -> Result<(), String> {
    if run.reply_discussion_id.is_none() && run.status == "completed" {
        conn.execute("UPDATE virtual_mr_ref_state SET needs_review=0 WHERE session_id=?1 AND base_sha=?2 AND head_sha=?3 AND NOT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND review_status NOT IN ('approved','changes_requested','commented'))",params![run.session_id,run.snapshot.base_sha,run.snapshot.head_sha]).map_err(|e|e.to_string())?;
    }
    Ok(())
}

/// Metadata saves carry whole session snapshots. Do not resurrect approval from
/// another window after the revision monitor invalidated it.
pub(crate) fn guard_saved(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE virtual_mr_ref_state SET needs_review=1,base_sha=NULL,head_sha=NULL,ref_status='unavailable',base_branch=(SELECT base_branch FROM virtual_mr_sessions WHERE id=?1),compare_branch=(SELECT compare_branch FROM virtual_mr_sessions WHERE id=?1),revision=revision+1 WHERE session_id=?1 AND (base_branch!=(SELECT base_branch FROM virtual_mr_sessions WHERE id=?1) OR compare_branch!=(SELECT compare_branch FROM virtual_mr_sessions WHERE id=?1))",[id])?;
    conn.execute("UPDATE virtual_mr_session_reviewers SET review_status='pending' WHERE session_id=?1 AND review_status='approved' AND EXISTS(SELECT 1 FROM virtual_mr_ref_state f WHERE f.session_id=?1 AND (f.needs_review=1 OR f.ref_status!='ready') AND NOT EXISTS(SELECT 1 FROM ai_review_runs a WHERE a.session_id=?1 AND a.status='completed' AND json_extract(a.payload,'$.published')=1 AND json_extract(a.payload,'$.replyDiscussionId') IS NULL AND json_extract(a.payload,'$.decision')='approve' AND json_extract(a.payload,'$.reviewerId')=virtual_mr_session_reviewers.agent_id AND json_extract(a.payload,'$.snapshot.baseSha')=f.base_sha AND json_extract(a.payload,'$.snapshot.headSha')=f.head_sha))",[id])?;
    conn.execute("UPDATE virtual_mr_sessions SET status='open' WHERE id=?1 AND status='resolved' AND EXISTS(SELECT 1 FROM virtual_mr_ref_state WHERE session_id=?1 AND needs_review=1) AND NOT EXISTS(SELECT 1 FROM virtual_mr_sessions n WHERE n.repo_id=virtual_mr_sessions.repo_id AND n.base_branch=virtual_mr_sessions.base_branch AND n.compare_branch=virtual_mr_sessions.compare_branch AND n.status='open' AND n.id!=?1)",[id])?;
    Ok(())
}
