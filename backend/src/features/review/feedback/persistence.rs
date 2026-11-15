use super::{candidate::eligible, source_key, FeedbackMemory};
use crate::{
    core::db::Database,
    features::review::{discussion_revision, security, ReviewRun},
};
use rusqlite::params;
use serde_json::json;

fn excerpt(text: &str, limit: usize) -> String {
    security::redact(text).chars().take(limit).collect()
}

pub(crate) fn memories(db: &Database, repo_id: &str) -> Result<Vec<FeedbackMemory>, String> {
    let conn = db.conn();
    let mut statement = conn.prepare("SELECT id,file_path,finding,feedback,reason,discussion_id,comment_id,updated_at,source_key,(SELECT session_id FROM virtual_mr_discussions WHERE id=discussion_id) FROM review_feedback WHERE repo_id=?1 AND active=1 ORDER BY updated_at DESC,id LIMIT 200").map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([repo_id], |r| {
            Ok((
                FeedbackMemory {
                    id: r.get(0)?,
                    file_path: r.get(1)?,
                    finding: r.get(2)?,
                    feedback: r.get(3)?,
                    reason: r.get(4)?,
                    discussion_id: r.get(5)?,
                    comment_id: r.get(6)?,
                    updated_at: r.get(7)?,
                },
                r.get::<_, String>(8)?,
                r.get::<_, Option<String>>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(statement);
    drop(conn);
    // Edits/deletions invalidate the original consent, including after restart.
    let mut valid = Vec::new();
    let mut sessions = std::collections::HashMap::new();
    for (memory, key, session) in rows {
        let Some(session) = session else {
            continue;
        };
        if !sessions.contains_key(&session) {
            sessions.insert(
                session.clone(),
                db.list_discussions(&session).map_err(|e| e.to_string())?,
            );
        }
        let thread = sessions[&session]
            .iter()
            .find(|t| t.id == memory.discussion_id);
        if thread
            .and_then(|t| super::candidate::key_for_comment(t, &memory.comment_id))
            .as_deref()
            == Some(&key)
        {
            valid.push(memory);
        } else {
            db.conn().execute("UPDATE review_feedback SET active=0,finding='',feedback='',reason='' WHERE id=?1 AND source_key=?2", params![memory.id,key]).map_err(|e| e.to_string())?;
        }
    }
    Ok(valid)
}

pub(crate) fn update(
    db: &Database,
    run: &ReviewRun,
    thread_id: &str,
    revision: &str,
    comment_id: &str,
    operation: &str,
    reason: &str,
) -> Result<(), String> {
    if !matches!(operation, "remember" | "forget" | "ignore")
        || reason.trim().is_empty()
        || reason.chars().count() > 400
    {
        return Err("Invalid feedback decision or reason".into());
    }
    if run
        .reply_discussion_id
        .as_ref()
        .is_some_and(|id| id != thread_id)
    {
        return Err("Feedback is outside the assigned discussion".into());
    }
    let thread =
        super::candidate::thread(db, thread_id)?.ok_or("Feedback discussion no longer exists")?;
    if !eligible(&thread, run.reviewer_id.as_deref()) {
        return Err(
            "Only human feedback on this reviewer's inline finding may be remembered".into(),
        );
    }
    let human = thread
        .comments
        .iter()
        .rev()
        .find(|c| c.author_type == "user")
        .unwrap();
    if human.id != comment_id {
        return Err("Feedback must use the latest human comment".into());
    }
    let key = source_key(&thread).unwrap();
    let mut conn = db.conn();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if discussion_revision::current(&tx, thread_id)? != revision {
        return Err("Feedback changed; read it again".into());
    }
    let repo: String = tx
        .query_row(
            "SELECT repo_id FROM virtual_mr_sessions WHERE id=?1",
            [&run.session_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let source_repo: String = tx
        .query_row(
            "SELECT repo_id FROM virtual_mr_sessions WHERE id=?1",
            [&thread.session_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if source_repo != repo {
        return Err("Feedback belongs to a different repository".into());
    }
    let assigned: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)", params![run.session_id,run.reviewer_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if !assigned {
        return Err("Reviewer is no longer assigned".into());
    }
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM review_feedback WHERE discussion_id=?1)",
            [thread_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let seen: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM review_feedback WHERE discussion_id=?1 AND processed_key=?2)", params![thread_id,key], |r| r.get(0)).map_err(|e| e.to_string())?;
    if seen {
        return Err(
            "This feedback was already processed or forgotten; do not learn it again".into(),
        );
    }
    let count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM review_feedback WHERE repo_id=?1",
            [&repo],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists && count >= 1000 {
        return Err("Repository feedback storage is full".into());
    }
    let active = operation == "remember";
    if active {
        let active_count: i64 = tx.query_row("SELECT COUNT(*) FROM review_feedback WHERE repo_id=?1 AND active=1 AND discussion_id<>?2", params![repo,thread_id], |r| r.get(0)).map_err(|e| e.to_string())?;
        if active_count >= 200 {
            return Err(
                "Review memory is full; remove unused memories in Repository Settings".into(),
            );
        }
    }
    // Ignore records classification, but does not rewrite an existing accepted preference.
    tx.execute("INSERT INTO review_feedback(id,repo_id,discussion_id,comment_id,file_path,source_key,processed_key,finding,feedback,reason,active,updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,?6,?7,?8,?9,?10,?11)
        ON CONFLICT(discussion_id) DO UPDATE SET processed_key=excluded.processed_key,
        comment_id=CASE WHEN ?12 THEN review_feedback.comment_id ELSE excluded.comment_id END,
        source_key=CASE WHEN ?12 THEN review_feedback.source_key ELSE excluded.source_key END,
        finding=CASE WHEN ?12 THEN review_feedback.finding ELSE excluded.finding END,
        feedback=CASE WHEN ?12 THEN review_feedback.feedback ELSE excluded.feedback END,
        reason=CASE WHEN ?12 THEN review_feedback.reason ELSE excluded.reason END,
        active=CASE WHEN ?12 THEN review_feedback.active ELSE excluded.active END,updated_at=excluded.updated_at",
        params![uuid::Uuid::new_v4().to_string(), repo, thread_id, comment_id, thread.file_path, key,
        if active {excerpt(&thread.comments[0].body,800)}else{String::new()},
        if active {excerpt(&human.body,800)}else{String::new()}, if active {excerpt(reason,400)}else{String::new()}, active,
        chrono::Utc::now().to_rfc3339(), operation == "ignore"]).map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO ai_review_events(run_id,kind,detail,created_at) VALUES(?1,'review_feedback',?2,?3)", params![run.id,
        json!({"discussionId":thread_id,"commentId":comment_id,"operation":operation}).to_string(),chrono::Utc::now().to_rfc3339()]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
