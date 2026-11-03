use super::VirtualMrDeletionActivity;
use crate::core::db::Database;
use rusqlite::{params, Connection, Row};

fn from_row(row: &Row<'_>) -> Result<VirtualMrDeletionActivity, rusqlite::Error> {
    Ok(VirtualMrDeletionActivity {
        id: row.get(0)?,
        session_id: row.get(1)?,
        discussion_id: row.get(2)?,
        comment_id: row.get(3)?,
        target_kind: row.get(4)?,
        actor_id: row.get(5)?,
        actor_name: row.get(6)?,
        created_at: row.get(7)?,
    })
}

const COLUMNS: &str =
    "id,session_id,discussion_id,comment_id,target_kind,actor_id,actor_name,created_at";

/// Called inside the deletion transaction; no foreign key points to the deleted content.
/// Retain identity and target IDs, never a copy of the deleted body.
pub(crate) fn record(
    conn: &Connection,
    session_id: &str,
    comment_id: &str,
    root: bool,
    actor_id: &str,
) -> Result<VirtualMrDeletionActivity, rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO virtual_mr_deletion_activity
            (id,session_id,discussion_id,comment_id,target_kind,actor_id,actor_name,created_at)
         SELECT ?1,?2,discussion_id,id,?4,?5,author_name,strftime('%Y-%m-%dT%H:%M:%fZ','now')
         FROM virtual_mr_comments WHERE id=?3",
        params![
            id,
            session_id,
            comment_id,
            if root { "discussion" } else { "reply" },
            actor_id
        ],
    )?;
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM virtual_mr_deletion_activity WHERE id=?1"),
        [id],
        from_row,
    )
}

impl Database {
    pub fn list_mr_deletion_activity(
        &self,
        session_id: &str,
    ) -> Result<Vec<VirtualMrDeletionActivity>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            &format!("SELECT {COLUMNS} FROM virtual_mr_deletion_activity WHERE session_id=?1 ORDER BY rowid ASC"),
        )?;
        let items = stmt.query_map([session_id], from_row)?.collect();
        items
    }
}

#[cfg(test)]
#[path = "deletion_activity_tests.rs"]
mod tests;
