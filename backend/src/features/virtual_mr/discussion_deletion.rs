use super::deletion_policy::deletable_comments;
use super::discussion_deletion_outcome::DiscussionDeletionOutcome;
use super::persistence::VirtualMrDiscussionDb;
use crate::core::db::Database;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde_json::{json, Value};

fn local_email(db: &Database, session_id: &str) -> Result<String, String> {
    let path = db
        .get_repo_path_for_session(session_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(denied)?;
    let result = crate::features::git::runner::run_git(&path, &["config", "user.email"])?;
    if result.success && !result.stdout.trim().is_empty() {
        Ok(result.stdout.trim().to_owned())
    } else if result.code == Some(1) {
        // Keep the existing local-author fallback when Git has no configured email.
        Ok("user@local.stage0".into())
    } else {
        Err(denied())
    }
}

fn denied() -> String {
    crate::common::messages::code("backend.virtualMr.deleteCommentDenied")
}

pub(super) fn with_permissions(
    db: &Database,
    session_id: &str,
    discussions: Vec<VirtualMrDiscussionDb>,
) -> Result<Value, String> {
    // Missing Git identity must never grant permission or prevent reading comments.
    let email = local_email(db, session_id).unwrap_or_default();
    let allowed =
        deletable_comments(&db.conn(), session_id, &email).map_err(|error| error.to_string())?;
    let mut output = serde_json::to_value(discussions).map_err(|error| error.to_string())?;
    if let Some(items) = output.as_array_mut() {
        for item in items {
            if let Some(comments) = item["comments"].as_array_mut() {
                for comment in comments {
                    comment["can_delete"] = json!(comment["id"]
                        .as_str()
                        .is_some_and(|id| allowed.contains(id)));
                }
            }
        }
    }
    Ok(output)
}

pub(super) fn delete(db: &Database, comment_id: &str) -> Result<DiscussionDeletionOutcome, String> {
    let session_id: String = db
        .conn()
        .query_row(
            "SELECT d.session_id FROM virtual_mr_comments c
         JOIN virtual_mr_discussions d ON d.id=c.discussion_id WHERE c.id=?1",
            [comment_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(denied)?;
    let email = local_email(db, &session_id)?;
    delete_for_author(db, &session_id, comment_id, &email)
}

pub(super) fn delete_for_author(
    db: &Database,
    session_id: &str,
    comment_id: &str,
    email: &str,
) -> Result<DiscussionDeletionOutcome, String> {
    let mut conn = db.conn();
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    // Recheck ownership, all persisted replies and cross-MR references under the write lock.
    if !deletable_comments(&tx, session_id, email)
        .map_err(|error| error.to_string())?
        .contains(comment_id)
    {
        return Err(denied());
    }
    let (discussion_id, root): (String, bool) = tx
        .query_row(
            "SELECT discussion_id, NOT EXISTS(SELECT 1 FROM virtual_mr_comments older
            WHERE older.discussion_id=c.discussion_id AND older.rowid<c.rowid)
         FROM virtual_mr_comments c WHERE id=?1",
            [comment_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| error.to_string())?;
    let activity =
        super::persistence::deletion_activity::record(&tx, session_id, comment_id, root, email)
            .map_err(|error| error.to_string())?;
    let session_title: String = tx
        .query_row(
            "SELECT title FROM virtual_mr_sessions WHERE id=?1",
            [session_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if root {
        tx.execute(
            "DELETE FROM virtual_mr_discussions WHERE id=?1",
            [&discussion_id],
        )
    } else {
        tx.execute("DELETE FROM virtual_mr_comments WHERE id=?1", [comment_id])
    }
    .map_err(|error| error.to_string())?;
    tx.execute(
        "UPDATE virtual_mr_sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=?1",
        params![session_id],
    )
    .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(DiscussionDeletionOutcome {
        discussion_id,
        deleted_discussion: root,
        activity,
        session_title,
    })
}

/// The worker owns both commit and one delivery attempt, independent of WebView lifetime.
/// A permission or OS delivery error must never report a committed deletion as failed.
pub(super) fn delete_and_notify(
    db: &Database,
    comment_id: &str,
    notify: impl FnOnce(&DiscussionDeletionOutcome) -> Result<(), String>,
) -> Result<DiscussionDeletionOutcome, String> {
    let outcome = delete(db, comment_id)?;
    if let Err(error) = notify(&outcome) {
        eprintln!("Discussion deletion notification delivery: {error}");
    }
    Ok(outcome)
}
