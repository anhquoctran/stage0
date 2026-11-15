use super::VirtualMrDiscussionActivity;
use crate::core::db::Database;
use rusqlite::{params, TransactionBehavior};

impl Database {
    /// State and its audit event commit together; retries do not create duplicate history.
    pub fn resolve_discussion_with_activity(
        &self,
        discussion_id: &str,
        is_resolved: bool,
        resolve_type: &str,
        actor_id: &str,
        actor_name: &str,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (session_id, previous): (String, bool) = tx.query_row(
            "SELECT session_id,is_resolved FROM virtual_mr_discussions WHERE id=?1",
            [discussion_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        if previous == is_resolved {
            return Ok(());
        }
        if is_resolved {
            tx.execute("UPDATE virtual_mr_discussions SET is_resolved=1,resolve_type=?1,resolved_by=?2,resolved_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?3", params![resolve_type,actor_name,discussion_id])?;
        } else {
            tx.execute("UPDATE virtual_mr_discussions SET is_resolved=0,resolved_by=NULL,resolved_at=NULL WHERE id=?1", [discussion_id])?;
        }
        if resolve_type == "manual" {
            tx.execute(
                "INSERT INTO virtual_mr_discussion_activity
                 (id,session_id,discussion_id,action,actor_id,actor_name,reviewer_name,file_path,created_at)
                 SELECT ?1,?2,d.id,?3,?4,?5,c.author_name,d.file_path,strftime('%Y-%m-%dT%H:%M:%fZ','now')
                 FROM virtual_mr_discussions d JOIN virtual_mr_comments c ON c.rowid=(SELECT MIN(root.rowid) FROM virtual_mr_comments root WHERE root.discussion_id=d.id)
                 WHERE d.id=?6 AND c.author_type='ai_agent'",
                params![uuid::Uuid::new_v4().to_string(),session_id,if is_resolved {"resolved"} else {"reopened"},actor_id,actor_name,discussion_id],
            )?;
        }
        tx.commit()
    }

    pub fn list_mr_discussion_activity(
        &self,
        session_id: &str,
    ) -> Result<Vec<VirtualMrDiscussionActivity>, rusqlite::Error> {
        let conn = self.conn();
        let mut statement = conn.prepare("SELECT id,session_id,discussion_id,action,actor_id,actor_name,reviewer_name,file_path,created_at FROM virtual_mr_discussion_activity WHERE session_id=?1 ORDER BY rowid")?;
        let rows = statement
            .query_map([session_id], |row| {
                Ok(VirtualMrDiscussionActivity {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    discussion_id: row.get(2)?,
                    action: row.get(3)?,
                    actor_id: row.get(4)?,
                    actor_name: row.get(5)?,
                    reviewer_name: row.get(6)?,
                    file_path: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .collect();
        rows
    }
}

#[cfg(test)]
#[path = "discussion_resolution_tests.rs"]
mod tests;
