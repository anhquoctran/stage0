use super::{VirtualMrCommentDb, VirtualMrDiscussionDb};
use crate::core::db::Database;
use rusqlite::params;
use std::collections::HashMap;

impl Database {
    // =======================================================================
    // Discussions & Comments
    // =======================================================================

    pub fn list_discussions(
        &self,
        session_id: &str,
    ) -> Result<Vec<VirtualMrDiscussionDb>, rusqlite::Error> {
        let conn = self.conn();

        // 1. Single batch query for all comments belonging to discussions in this session (eliminates N+1)
        let mut comments_map: HashMap<String, Vec<VirtualMrCommentDb>> = HashMap::new();
        {
            let mut c_stmt = conn.prepare_cached(
                "SELECT c.id, c.discussion_id, c.author_type, c.author_id, c.author_name, c.author_avatar,
                        c.body, c.review_action, c.created_at, c.updated_at
                 FROM virtual_mr_comments c
                 JOIN virtual_mr_discussions d ON c.discussion_id = d.id
                 WHERE d.session_id = ?1
                 ORDER BY c.rowid ASC;",
            )?;
            let c_rows = c_stmt.query_map(params![session_id], |crow| {
                Ok(VirtualMrCommentDb {
                    id: crow.get(0)?,
                    discussion_id: crow.get(1)?,
                    author_type: crow.get(2)?,
                    author_id: crow.get(3)?,
                    author_name: crow.get(4)?,
                    author_avatar: crow.get(5)?,
                    body: crow.get(6)?,
                    review_action: crow.get(7)?,
                    created_at: crow.get(8)?,
                    updated_at: crow.get(9)?,
                })
            })?;

            for c in c_rows {
                let comment = c?;
                comments_map
                    .entry(comment.discussion_id.clone())
                    .or_default()
                    .push(comment);
            }
        }

        // 2. Fetch discussions in a single cached query
        let mut stmt = conn.prepare_cached(
            "SELECT id, session_id, file_path, diff_side, line_number, commit_id,
                    content_hash, context_before, context_after,
                    is_resolved, resolve_type, resolved_by, resolved_at,
                    verification_status, verified_by_bot, verified_at, created_at, code_snippet
             FROM virtual_mr_discussions WHERE session_id = ?1 ORDER BY created_at ASC;",
        )?;

        let disc_rows = stmt.query_map(params![session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, Option<String>>(12)?,
                row.get::<_, String>(13)?,
                row.get::<_, Option<String>>(14)?,
                row.get::<_, Option<String>>(15)?,
                row.get::<_, String>(16)?,
                row.get::<_, Option<String>>(17)?,
            ))
        })?;

        let mut discussions = Vec::new();
        for d in disc_rows {
            let (
                id,
                s_id,
                fpath,
                side,
                lnum,
                cid,
                chash,
                cbefore,
                cafter,
                resolved,
                rtype,
                rby,
                rat,
                vstatus,
                vbot,
                vat,
                cat,
                code_snippet,
            ) = d?;
            let comments = comments_map.remove(&id).unwrap_or_default();

            discussions.push(VirtualMrDiscussionDb {
                id,
                session_id: s_id,
                file_path: fpath,
                diff_side: side,
                line_number: lnum,
                commit_id: cid,
                code_snippet: code_snippet.and_then(|value| serde_json::from_str(&value).ok()),
                content_hash: chash,
                context_before: cbefore,
                context_after: cafter,
                is_resolved: resolved,
                resolve_type: rtype,
                resolved_by: rby,
                resolved_at: rat,
                verification_status: vstatus,
                verified_by_bot: vbot,
                verified_at: vat,
                created_at: cat,
                comments,
            });
        }

        Ok(discussions)
    }

    pub fn get_repo_path_for_session(
        &self,
        session_id: &str,
    ) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT r.local_path
             FROM virtual_mr_sessions s
             JOIN repositories r ON s.repo_id = r.id
             WHERE s.id = ?1;",
        )?;
        let mut rows = stmt.query(params![session_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn update_discussion_anchors(
        &self,
        discussions: &[VirtualMrDiscussionDb],
    ) -> Result<(), rusqlite::Error> {
        if discussions.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare_cached(
                "UPDATE virtual_mr_discussions
                 SET line_number = ?1, verification_status = ?2
                 WHERE id = ?3;",
            )?;
            for discussion in discussions {
                stmt.execute(params![
                    discussion.line_number,
                    discussion.verification_status,
                    discussion.id,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn create_discussion(
        &self,
        d: &VirtualMrDiscussionDb,
        first_comment: &VirtualMrCommentDb,
    ) -> Result<(), rusqlite::Error> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;

        let code_snippet = d
            .code_snippet
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        tx.execute(
            "INSERT INTO virtual_mr_discussions (
                id, session_id, file_path, diff_side, line_number, commit_id,
                content_hash, context_before, context_after,
                is_resolved, resolve_type, resolved_by, resolved_at,
                verification_status, verified_by_bot, verified_at, created_at, code_snippet
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?17);",
            params![
                d.id, d.session_id, d.file_path, d.diff_side, d.line_number, d.commit_id,
                d.content_hash, d.context_before, d.context_after,
                d.is_resolved, d.resolve_type, d.resolved_by, d.resolved_at,
                d.verification_status, d.verified_by_bot, d.verified_at, code_snippet
            ],
        )?;

        tx.execute(
            "INSERT INTO virtual_mr_comments (
                id, discussion_id, author_type, author_id, author_name, author_avatar, body, review_action, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));",
            params![
                first_comment.id, first_comment.discussion_id, first_comment.author_type,
                first_comment.author_id, first_comment.author_name, first_comment.author_avatar,
                first_comment.body, first_comment.review_action
            ],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn add_comment(&self, c: &VirtualMrCommentDb) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "INSERT INTO virtual_mr_comments (
                id, discussion_id, author_type, author_id, author_name, author_avatar, body, review_action, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));",
        )?;
        stmt.execute(params![
            c.id,
            c.discussion_id,
            c.author_type,
            c.author_id,
            c.author_name,
            c.author_avatar,
            c.body,
            c.review_action
        ])?;
        Ok(())
    }

    pub fn resolve_discussion(
        &self,
        discussion_id: &str,
        is_resolved: bool,
        resolve_type: &str,
        resolved_by: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        if is_resolved {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET is_resolved = 1, resolve_type = ?1, resolved_by = ?2, resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?3;",
            )?;
            stmt.execute(params![resolve_type, resolved_by, discussion_id])?;
        } else {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET is_resolved = 0, resolved_by = NULL, resolved_at = NULL WHERE id = ?1;",
            )?;
            stmt.execute(params![discussion_id])?;
        }
        Ok(())
    }

    pub fn verify_discussion(
        &self,
        discussion_id: &str,
        verification_status: &str,
        verified_by_bot: &str,
        pass: bool,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn();
        if pass {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET
                    is_resolved = 1,
                    resolve_type = 'ai_verified',
                    resolved_by = ?1,
                    resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                    verification_status = ?2,
                    verified_by_bot = ?1,
                    verified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE id = ?3;",
            )?;
            stmt.execute(params![verified_by_bot, verification_status, discussion_id])?;
        } else {
            let mut stmt = conn.prepare_cached(
                "UPDATE virtual_mr_discussions SET
                    verification_status = ?1,
                    verified_by_bot = ?2,
                    verified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE id = ?3;",
            )?;
            stmt.execute(params![verification_status, verified_by_bot, discussion_id])?;
        }
        Ok(())
    }
}
