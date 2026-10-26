//! Fingerprint the exact thread read by the model, including edits without a new ID.
use crate::features::virtual_mr::persistence::VirtualMrDiscussionDb;
use rusqlite::Connection;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn digest(header: Value, comments: Vec<Value>) -> String {
    format!(
        "{:x}",
        Sha256::digest(json!([header, comments]).to_string().as_bytes())
    )
}

pub fn of(discussion: &VirtualMrDiscussionDb) -> String {
    digest(
        json!([
            discussion.session_id,
            discussion.file_path,
            discussion.diff_side,
            discussion.line_number,
            discussion.commit_id,
            discussion.is_resolved
        ]),
        discussion
            .comments
            .iter()
            .map(|c| {
                json!([
                    c.id,
                    c.author_type,
                    c.author_id,
                    c.author_name,
                    c.body,
                    c.review_action,
                    c.created_at,
                    c.updated_at
                ])
            })
            .collect(),
    )
}

/// Called inside the publication transaction; no second connection or lock.
pub fn current(conn: &Connection, id: &str) -> Result<String, String> {
    let header = conn.query_row(
        "SELECT session_id,file_path,diff_side,line_number,commit_id,is_resolved FROM virtual_mr_discussions WHERE id=?1", [id],
        |r| Ok(json!([r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?, r.get::<_, Option<String>>(2)?, r.get::<_, Option<i64>>(3)?, r.get::<_, Option<String>>(4)?, r.get::<_, bool>(5)?])),
    ).map_err(|_| "The discussion no longer exists")?;
    let mut statement = conn.prepare("SELECT id,author_type,author_id,author_name,body,review_action,created_at,updated_at FROM virtual_mr_comments WHERE discussion_id=?1 ORDER BY rowid ASC").map_err(|e| e.to_string())?;
    let comments = statement
        .query_map([id], |r| {
            Ok(json!([
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, String>(7)?
            ]))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(digest(header, comments))
}
