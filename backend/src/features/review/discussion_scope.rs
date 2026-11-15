//! Exact host control requests are not unresolved code-review concerns.
use super::mentions;
use crate::features::virtual_mr::persistence::VirtualMrDiscussionDb;
use rusqlite::Connection;

fn control_root(path: Option<&str>, kind: &str, body: &str, has_non_bot_reply: bool) -> bool {
    if path.is_some()
        || kind != "user"
        || has_non_bot_reply
        || !mentions::is_manual_review_command(body)
    {
        return false;
    }
    // Require a single mention, not an ordinary comment ending with another bot command.
    let Some((label, _)) = body.trim().rsplit_once("](") else {
        return false;
    };
    let mut escaped = false;
    for ch in label[2..].chars() {
        if escaped {
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
        } else if matches!(ch, '[' | ']') {
            return false;
        }
    }
    !escaped
}

pub(crate) fn is_control(thread: &VirtualMrDiscussionDb) -> bool {
    thread.comments.first().is_some_and(|root| {
        control_root(
            thread.file_path.as_deref(),
            &root.author_type,
            &root.body,
            thread
                .comments
                .iter()
                .skip(1)
                .any(|c| c.author_type != "ai_agent"),
        )
    })
}

pub(crate) fn requires_resolution(thread: &VirtualMrDiscussionDb) -> bool {
    // Even a malformed stored anchor must not silently bypass an approval gate.
    thread.file_path.is_some()
}

/// UI resolution concerns are file-anchored. Read on the publication transaction
/// so late/new inline concerns still block approval. Malformed anchors fail closed.
pub(crate) fn unresolved_ids(conn: &Connection, session: &str) -> Result<Vec<String>, String> {
    let mut stmt=conn.prepare("SELECT id FROM virtual_mr_discussions WHERE session_id=?1 AND is_resolved=0 AND file_path IS NOT NULL ORDER BY rowid").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([session], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
