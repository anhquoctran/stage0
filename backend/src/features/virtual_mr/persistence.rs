mod virtual_mr_session_db;
pub use virtual_mr_session_db::VirtualMrSessionDb;
mod virtual_mr_session_save_outcome;
pub use virtual_mr_session_save_outcome::VirtualMrSessionSaveOutcome;
mod virtual_mr_reviewer_db;
pub use virtual_mr_reviewer_db::VirtualMrReviewerDb;
mod discussion_code_snippet;
pub use discussion_code_snippet::DiscussionCodeSnippet;
mod virtual_mr_comment_db;
pub use virtual_mr_comment_db::VirtualMrCommentDb;
mod virtual_mr_discussion_db;
pub use virtual_mr_discussion_db::VirtualMrDiscussionDb;

use crate::core::db::Database;
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use std::collections::HashMap;

#[cfg(test)]
mod tests;

impl Database {
    // =======================================================================
    // Virtual MR Sessions
    // =======================================================================

    pub fn list_virtual_mr_sessions(
        &self,
        repo_id: &str,
    ) -> Result<Vec<VirtualMrSessionDb>, rusqlite::Error> {
        let conn = self.conn();

        // 1. Single batch query for all attached label mappings of sessions in this repo (eliminates N+1)
        let mut label_map: HashMap<String, Vec<String>> = HashMap::new();
        {
            let mut label_stmt = conn.prepare_cached(
                "SELECT sl.session_id, sl.label_id
                 FROM virtual_mr_session_labels sl
                 JOIN virtual_mr_sessions s ON sl.session_id = s.id
                 WHERE s.repo_id = ?1;",
            )?;
            let l_rows = label_stmt.query_map(params![repo_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            for item in l_rows {
                let (sid, lid) = item?;
                label_map.entry(sid).or_default().push(lid);
            }
        }

        let mut reviewer_map: HashMap<String, Vec<VirtualMrReviewerDb>> = HashMap::new();
        {
            let mut stmt = conn.prepare_cached(
                "SELECT r.session_id, r.agent_id, r.agent_name, r.review_status, r.assigned_at
                 FROM virtual_mr_session_reviewers r
                 JOIN virtual_mr_sessions s ON s.id = r.session_id
                 WHERE s.repo_id = ?1 ORDER BY r.assigned_at, r.agent_id;",
            )?;
            let rows = stmt.query_map(params![repo_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    VirtualMrReviewerDb {
                        agent_id: row.get(1)?,
                        agent_name: row.get(2)?,
                        review_status: row.get(3)?,
                        assigned_at: row.get(4)?,
                    },
                ))
            })?;
            for row in rows {
                let (session_id, reviewer) = row?;
                reviewer_map.entry(session_id).or_default().push(reviewer);
            }
        }

        // Fetch sessions after batching their label and reviewer mappings.
        let mut stmt = conn.prepare_cached(
            "SELECT id, repo_id, title, description, base_branch, compare_branch, status,
                    assignee_name, assignee_email, is_pinned, sandbox_adapter_type, sandbox_instance_id,
                    created_at, updated_at
             FROM virtual_mr_sessions WHERE repo_id = ?1 ORDER BY updated_at DESC;",
        )?;

        let session_rows = stmt.query_map(params![repo_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, String>(12)?,
                row.get::<_, String>(13)?,
            ))
        })?;

        let mut sessions = Vec::new();
        for r in session_rows {
            let (
                id,
                repo_id,
                title,
                desc,
                base,
                comp,
                status,
                aname,
                aemail,
                pinned,
                s_type,
                s_inst,
                cat,
                uat,
            ) = r?;
            let label_ids = label_map.remove(&id).unwrap_or_default();
            let reviewers = reviewer_map.remove(&id).unwrap_or_default();

            sessions.push(VirtualMrSessionDb {
                id,
                repo_id,
                title,
                description: desc,
                base_branch: base,
                compare_branch: comp,
                status,
                assignee_name: aname,
                assignee_email: aemail,
                is_pinned: pinned,
                sandbox_adapter_type: s_type,
                sandbox_instance_id: s_inst,
                created_at: cat,
                updated_at: uat,
                label_ids,
                reviewers,
            });
        }

        Ok(sessions)
    }

    pub fn save_virtual_mr_session(
        &self,
        s: &VirtualMrSessionDb,
    ) -> Result<VirtualMrSessionSaveOutcome, rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;

        if s.status == "open" {
            let duplicate = tx
                .query_row(
                    "SELECT id, title FROM virtual_mr_sessions
                     WHERE repo_id = ?1 AND compare_branch = ?2 AND base_branch = ?3
                       AND status = 'open' AND id != ?4
                     ORDER BY rowid ASC LIMIT 1;",
                    params![s.repo_id, s.compare_branch, s.base_branch, s.id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()?;

            if let Some((existing_id, existing_title)) = duplicate {
                return Ok(VirtualMrSessionSaveOutcome::DuplicateOpen {
                    existing_id,
                    existing_title,
                    base_branch: s.base_branch.clone(),
                    compare_branch: s.compare_branch.clone(),
                });
            }
        }

        // Atomic session upsert within transaction
        tx.execute(
            "INSERT INTO virtual_mr_sessions (
                id, repo_id, title, description, base_branch, compare_branch, status,
                assignee_name, assignee_email, is_pinned, sandbox_adapter_type, sandbox_instance_id,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                base_branch = excluded.base_branch,
                compare_branch = excluded.compare_branch,
                status = excluded.status,
                assignee_name = excluded.assignee_name,
                assignee_email = excluded.assignee_email,
                is_pinned = excluded.is_pinned,
                sandbox_adapter_type = excluded.sandbox_adapter_type,
                sandbox_instance_id = excluded.sandbox_instance_id,
                updated_at = CURRENT_TIMESTAMP;",
            params![
                s.id, s.repo_id, s.title, s.description, s.base_branch, s.compare_branch, s.status,
                s.assignee_name, s.assignee_email, s.is_pinned, s.sandbox_adapter_type, s.sandbox_instance_id
            ],
        )?;

        // Update labels atomically
        tx.execute(
            "DELETE FROM virtual_mr_session_labels WHERE session_id = ?1;",
            params![s.id],
        )?;
        for lid in &s.label_ids {
            tx.execute(
                "INSERT OR IGNORE INTO virtual_mr_session_labels (session_id, label_id) VALUES (?1, ?2);",
                params![s.id, lid],
            )?;
        }

        tx.execute(
            "DELETE FROM virtual_mr_session_reviewers WHERE session_id = ?1;",
            params![s.id],
        )?;
        for reviewer in &s.reviewers {
            tx.execute(
                "INSERT INTO virtual_mr_session_reviewers
                    (session_id, agent_id, agent_name, review_status, assigned_at)
                 VALUES (?1, ?2, ?3, ?4, ?5);",
                params![
                    s.id,
                    reviewer.agent_id,
                    reviewer.agent_name,
                    reviewer.review_status,
                    reviewer.assigned_at
                ],
            )?;
        }

        tx.commit()?;
        Ok(VirtualMrSessionSaveOutcome::Saved)
    }

    pub fn delete_virtual_mr_session(&self, session_id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("DELETE FROM virtual_mr_sessions WHERE id = ?1;")?;
        stmt.execute(params![session_id])?;
        Ok(())
    }
}

mod discussions;
