use crate::{
    core::db::Database,
    features::{
        review::{security, ReviewRun},
        virtual_mr::persistence::VirtualMrDiscussionDb,
    },
};
use serde_json::json;
use sha2::{Digest, Sha256};

pub(crate) fn source_key(thread: &VirtualMrDiscussionDb) -> Option<String> {
    let human = thread
        .comments
        .iter()
        .rev()
        .find(|c| c.author_type == "user")?;
    key_for_comment(thread, &human.id)
}

pub(crate) fn key_for_comment(thread: &VirtualMrDiscussionDb, id: &str) -> Option<String> {
    let root = thread.comments.first()?;
    let human = thread
        .comments
        .iter()
        .find(|c| c.id == id && c.author_type == "user")?;
    Some(format!(
        "{:x}",
        Sha256::digest(
            json!([
                root.id,
                root.body,
                human.id,
                human.body,
                thread.file_path,
                thread.diff_side,
                thread.commit_id
            ])
            .to_string()
            .as_bytes()
        )
    ))
}

pub(crate) fn eligible(thread: &VirtualMrDiscussionDb, reviewer: Option<&str>) -> bool {
    thread.file_path.is_some()
        && thread.commit_id.is_some()
        && thread
            .comments
            .first()
            .is_some_and(|c| c.author_type == "ai_agent" && Some(c.author_id.as_str()) == reviewer)
        && thread
            .comments
            .iter()
            .any(|c| c.author_type == "user" && !security::redact(&c.body).trim().is_empty())
}

pub(crate) fn candidates(
    db: &Database,
    run: &ReviewRun,
) -> Result<Vec<VirtualMrDiscussionDb>, String> {
    // Discovery stays in this repository. Closed/older MRs can teach the next full review.
    let ids = {
        let conn = db.conn();
        let mut query = conn.prepare("SELECT d.id,d.session_id FROM virtual_mr_discussions d
            JOIN virtual_mr_sessions s ON s.id=d.session_id
            JOIN virtual_mr_comments root ON root.rowid=(SELECT MIN(c.rowid) FROM virtual_mr_comments c WHERE c.discussion_id=d.id)
            WHERE s.repo_id=(SELECT repo_id FROM virtual_mr_sessions WHERE id=?1)
            AND root.author_type='ai_agent' AND root.author_id=?2 AND d.file_path IS NOT NULL AND d.commit_id IS NOT NULL
            AND EXISTS(SELECT 1 FROM virtual_mr_comments c WHERE c.discussion_id=d.id AND c.author_type='user')
            AND (?3 IS NULL OR (d.id=?3 AND d.session_id=?1))
            ORDER BY (SELECT MAX(c.rowid) FROM virtual_mr_comments c WHERE c.discussion_id=d.id AND c.author_type='user') DESC LIMIT 1000").map_err(|e| e.to_string())?;
        let rows = query
            .query_map(
                rusqlite::params![run.session_id, run.reviewer_id, run.reply_discussion_id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    let mut sessions = std::collections::HashMap::new();
    let mut out = Vec::new();
    for (id, session) in ids {
        if !sessions.contains_key(&session) {
            sessions.insert(
                session.clone(),
                db.list_discussions(&session).map_err(|e| e.to_string())?,
            );
        }
        let Some(thread) = sessions
            .get_mut(&session)
            .unwrap()
            .iter_mut()
            .find(|t| t.id == id)
        else {
            continue;
        };
        if !eligible(thread, run.reviewer_id.as_deref()) {
            continue;
        }
        let key = source_key(thread).unwrap();
        let seen: bool = db.conn().query_row("SELECT EXISTS(SELECT 1 FROM review_feedback WHERE discussion_id=?1 AND processed_key=?2)",
            rusqlite::params![thread.id, key], |r| r.get(0)).map_err(|e| e.to_string())?;
        if !seen {
            out.push(thread.clone());
        }
        if out.len() == 20 {
            break;
        }
    }
    Ok(out)
}

pub(crate) fn thread(db: &Database, id: &str) -> Result<Option<VirtualMrDiscussionDb>, String> {
    use rusqlite::OptionalExtension;
    let session: Option<String> = db
        .conn()
        .query_row(
            "SELECT session_id FROM virtual_mr_discussions WHERE id=?1",
            [id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    session
        .map(|session| {
            db.list_discussions(&session)
                .map(|threads| threads.into_iter().find(|t| t.id == id))
                .map_err(|e| e.to_string())
        })
        .transpose()
        .map(Option::flatten)
}
