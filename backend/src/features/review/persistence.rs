use super::ReviewRun;
use crate::core::db::Database;
use rusqlite::params;
use serde_json::{json, Value};

pub enum ReviewDiscussionAction {
    Reply {
        discussion_id: String,
        target_comment_id: String,
        discussion_revision: String,
        body: String,
    },
    Resolve {
        discussion_id: String,
        target_comment_id: String,
        discussion_revision: String,
        file_path: String,
        side: String,
        start_line: usize,
        end_line: usize,
        evidence: String,
        body: String,
        reverted_commit_id: Option<String>,
    },
}

impl Database {
    pub fn update_review_generated_description(
        &self,
        session_id: &str,
        description: &str,
    ) -> Result<(), String> {
        let changed = self.conn().execute(
            "UPDATE virtual_mr_sessions SET description=?2, updated_at=CURRENT_TIMESTAMP WHERE id=?1",
            params![session_id, description],
        ).map_err(|error| {
            crate::common::messages::failure(
                "backend.review.updateDescriptionFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Could not update the Virtual MR description: {error}"),
            )
        })?;
        if changed != 1 {
            return Err(crate::common::messages::code("backend.review.mrNoLongerExists"));
        }
        Ok(())
    }

    pub fn save_review_run(&self, run: &ReviewRun) -> Result<(), String> {
        let payload = serde_json::to_string(run)
            .map_err(|_| crate::common::messages::code("backend.review.serializeRunFailed"))?;
        self.conn().execute("INSERT INTO ai_review_runs(id,session_id,status,payload,started_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",params![run.id,run.session_id,run.status,payload,run.started_at]).map_err(|e| {
            crate::common::messages::failure(
                "backend.review.saveRunStateFailed",
                serde_json::json!({ "error": e.to_string() }),
                format!("Could not save review state: {e}"),
            )
        })?;
        Ok(())
    }
    pub fn get_review_run(&self, id: &str) -> Result<ReviewRun, String> {
        let (payload, status): (String, String) = self
            .conn()
            .query_row(
                "SELECT payload,status FROM ai_review_runs WHERE id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| crate::common::messages::code("backend.review.runNotFound"))?;
        let mut run: ReviewRun = serde_json::from_str(&payload)
            .map_err(|_| crate::common::messages::code("backend.review.invalidStoredRun"))?;
        if status == "interrupted" {
            run.status = status;
            run.error = Some(crate::common::messages::code(
                "backend.review.interruptedByShutdown",
            ));
        }
        Ok(run)
    }
    pub fn list_review_runs(&self, session: &str) -> Result<Vec<ReviewRun>, String> {
        let ids = {
            let conn = self.conn();
            let mut stmt=conn.prepare("SELECT id FROM ai_review_runs WHERE session_id=?1 ORDER BY started_at DESC LIMIT 10").map_err(|e|e.to_string())?;
            let rows = stmt
                .query_map([session], |row| row.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };
        ids.iter().map(|id| self.get_review_run(id)).collect()
    }
    pub fn review_event(&self, id: &str, kind: &str, detail: Value) -> Result<(), String> {
        self.conn()
            .execute(
                "INSERT INTO ai_review_events(run_id,kind,detail,created_at) VALUES(?1,?2,?3,?4)",
                params![
                    id,
                    kind,
                    detail.to_string(),
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn review_events(&self, id: &str) -> Result<Vec<Value>, String> {
        let conn = self.conn();
        let mut stmt=conn.prepare("SELECT seq,kind,detail,created_at FROM ai_review_events WHERE run_id=?1 ORDER BY seq LIMIT 200").map_err(|e|e.to_string())?;
        let rows=stmt.query_map([id],|row|Ok(json!({"seq":row.get::<_,i64>(0)?,"kind":row.get::<_,String>(1)?,"detail":serde_json::from_str::<Value>(&row.get::<_,String>(2)?).unwrap_or(Value::Null),"createdAt":row.get::<_,String>(3)?}))).map_err(|e|e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    pub fn publish_review(&self, run: &ReviewRun) -> Result<(), String> {
        self.publish_review_actions(run, &[])
    }

    pub fn publish_review_actions(
        &self,
        run: &ReviewRun,
        actions: &[ReviewDiscussionAction],
    ) -> Result<(), String> {
        if !matches!(run.status.as_str(), "completed" | "partial") {
            return Err("Only finished review findings may be published".into());
        }
        if let Some(target) = run.reply_discussion_id.as_deref() {
            if run.decision.as_deref() != Some("comment") || !run.findings.is_empty() || run.generated_description.is_some()
                || actions.iter().any(|action| !matches!(action, ReviewDiscussionAction::Reply { discussion_id, .. } if discussion_id == target)) {
                return Err("Discussion reply runs cannot publish MR verdicts, findings, descriptions or other discussion actions".into());
            }
        }
        let mut conn = self.conn();
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        if run.reply_discussion_id.is_some() {
            let reviewer = run
                .reviewer_id
                .as_deref()
                .ok_or("Discussion replies require an assigned reviewer")?;
            let assigned: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM virtual_mr_session_reviewers WHERE session_id=?1 AND agent_id=?2)", [&run.session_id, reviewer], |row| row.get(0)).map_err(|e| e.to_string())?;
            if !assigned {
                return Err(
                    "The reviewer was unassigned before the discussion reply could be posted"
                        .into(),
                );
            }
        }
        let reviewer = run.reviewer_name.as_deref().unwrap_or(&run.model);
        let author_id = run.reviewer_id.as_deref().unwrap_or(&run.id);
        let author_name = format!("Stage0 AI ({reviewer})");
        for (index, finding) in run.findings.iter().enumerate() {
            let id = format!("review-{}-{index}", run.id);
            let sha = if finding.side == "base" {
                &run.snapshot.merge_base_sha
            } else {
                &run.snapshot.head_sha
            };
            let side = if finding.side == "base" {
                "left"
            } else {
                "right"
            };
            let body = format!(
                "**[{}] {}**\n\n{}",
                finding.severity,
                finding.title,
                super::security::redact(&finding.body)
            );
            tx.execute("INSERT OR IGNORE INTO virtual_mr_discussions(id,session_id,file_path,diff_side,line_number,commit_id,is_resolved,resolve_type,verification_status,created_at) VALUES(?1,?2,?3,?4,?5,?6,0,'manual','none',?7)",params![id,run.session_id,finding.file_path,side,finding.start_line as i64,sha,run.started_at]).map_err(|e|e.to_string())?;
            tx.execute("INSERT OR IGNORE INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,review_action,created_at,updated_at) VALUES(?1,?2,'ai_agent',?3,?4,?5,'comment',?6,?6)",params![format!("{id}-comment"),id,author_id,author_name,body,run.started_at]).map_err(|e|e.to_string())?;
        }
        for (index, action) in actions.iter().enumerate() {
            match action {
                ReviewDiscussionAction::Reply {
                    discussion_id,
                    target_comment_id,
                    discussion_revision,
                    body,
                } => {
                    if super::discussion_revision::current(&tx, discussion_id)?
                        != *discussion_revision
                    {
                        return Err(
                            "The discussion changed before the AI reply could be posted".into()
                        );
                    }
                    let (session_id, is_resolved, latest_id): (String, bool, Option<String>) = tx.query_row(
                        "SELECT d.session_id, d.is_resolved, (SELECT c.id FROM virtual_mr_comments c WHERE c.discussion_id=d.id ORDER BY c.rowid DESC LIMIT 1) FROM virtual_mr_discussions d WHERE d.id=?1",
                        [discussion_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    ).map_err(|_| "Discussion was removed before the AI reply could be posted")?;
                    if session_id != run.session_id
                        || is_resolved
                        || latest_id.as_deref() != Some(target_comment_id.as_str())
                    {
                        return Err(
                            "The discussion changed before the AI reply could be posted".into()
                        );
                    }
                    let (kind, id, previous_body): (String, String, String) = tx.query_row(
                        "SELECT author_type,author_id,body FROM virtual_mr_comments WHERE id=?1", [target_comment_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    ).map_err(|error| error.to_string())?;
                    if !super::mentions::can_reply_to_comment(
                        &tx,
                        &run.session_id,
                        run.reviewer_id.as_deref(),
                        &kind,
                        &id,
                        &previous_body,
                    ) {
                        return Err("AI reply requires an unanswered user comment or a direct mention from another reviewer".into());
                    }
                    let now = chrono::Utc::now().to_rfc3339();
                    tx.execute(
                        "INSERT OR IGNORE INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,review_action,created_at,updated_at) VALUES(?1,?2,'ai_agent',?3,?4,?5,'comment',?6,?6)",
                        params![format!("review-{}-reply-{index}", run.id), discussion_id, author_id, author_name, super::security::redact(body), now],
                    ).map_err(|e| e.to_string())?;
                }
                ReviewDiscussionAction::Resolve {
                    discussion_id,
                    target_comment_id,
                    discussion_revision,
                    file_path,
                    side,
                    start_line,
                    end_line,
                    evidence,
                    body,
                    reverted_commit_id,
                } => {
                    if side != "head"
                        || super::discussion_revision::current(&tx, discussion_id)?
                            != *discussion_revision
                    {
                        return Err("The discussion changed or resolution evidence is not current-head evidence".into());
                    }
                    let (session_id, stored_path, is_resolved, latest_id): (String, Option<String>, bool, Option<String>) = tx.query_row(
                        "SELECT d.session_id, d.file_path, d.is_resolved, (SELECT c.id FROM virtual_mr_comments c WHERE c.discussion_id=d.id ORDER BY c.rowid DESC LIMIT 1) FROM virtual_mr_discussions d WHERE d.id=?1",
                        [discussion_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                    ).map_err(|_| "Discussion was removed before automatic resolution")?;
                    if session_id != run.session_id
                        || is_resolved
                        || stored_path.as_deref() != Some(file_path.as_str())
                        || latest_id.as_deref() != Some(target_comment_id.as_str())
                    {
                        return Err(
                            "AI can resolve only an open discussion on the same changed file"
                                .into(),
                        );
                    }
                    let now = chrono::Utc::now().to_rfc3339();
                    let verification = if let Some(original_sha) = reverted_commit_id {
                        format!(
                            "Verified that the current head of `{file_path}` matches the MR base, and that its branch-only contents from the previously reviewed commit `{original_sha}` are no longer present. Current head evidence, lines {start_line}–{end_line}:\n\n```\n{evidence}\n```"
                        )
                    } else {
                        format!(
                            "Verified against `{file_path}` lines {start_line}–{end_line} on the `{side}` side:\n\n```\n{evidence}\n```"
                        )
                    };
                    let resolution = format!(
                        "**Resolved by AI review**\n\n{}\n\n{}",
                        super::security::redact(body),
                        verification,
                    );
                    tx.execute(
                        "INSERT OR IGNORE INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,review_action,created_at,updated_at) VALUES(?1,?2,'ai_agent',?3,?4,?5,'comment',?6,?6)",
                        params![format!("review-{}-resolve-{index}", run.id), discussion_id, author_id, author_name, resolution, now],
                    ).map_err(|e| e.to_string())?;
                    let changed = tx.execute(
                        "UPDATE virtual_mr_discussions SET is_resolved=1, resolve_type='ai_verified', resolved_by=?1, resolved_at=CURRENT_TIMESTAMP, verification_status='pass', verified_by_bot=?1, verified_at=CURRENT_TIMESTAMP WHERE id=?2 AND session_id=?3 AND is_resolved=0",
                        params![author_name, discussion_id, run.session_id],
                    ).map_err(|e| e.to_string())?;
                    if changed != 1 {
                        return Err(
                            "Discussion changed before automatic resolution could be committed"
                                .into(),
                        );
                    }
                }
            }
        }
        if let Some(reviewer_id) = run
            .reviewer_id
            .as_deref()
            .filter(|_| run.reply_discussion_id.is_none())
        {
            let unresolved_count: i64 = tx
                .query_row(
                    "SELECT COUNT(*) FROM virtual_mr_discussions WHERE session_id=?1 AND is_resolved=0",
                    [&run.session_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            let reviewer_status = if run.status == "completed"
                && run.decision.as_deref() == Some("approve")
                && run.findings.is_empty()
                && unresolved_count == 0
            {
                "approved"
            } else if run.decision.as_deref() == Some("request_changes") || !run.findings.is_empty()
            {
                "changes_requested"
            } else {
                "commented"
            };
            let updated_reviewer = tx.execute(
                "UPDATE virtual_mr_session_reviewers SET review_status=?1 WHERE session_id=?2 AND agent_id=?3",
                params![reviewer_status, run.session_id, reviewer_id],
            )
            .map_err(|e| e.to_string())?;

            if updated_reviewer == 1 {
                let assigned_count: i64 = tx
                    .query_row(
                        "SELECT COUNT(*) FROM virtual_mr_session_reviewers WHERE session_id=?1",
                        [&run.session_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                let unapproved_count: i64 = tx
                    .query_row(
                        "SELECT COUNT(*) FROM virtual_mr_session_reviewers WHERE session_id=?1 AND review_status!='approved'",
                        [&run.session_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                if assigned_count > 0 && unapproved_count == 0 && unresolved_count == 0 {
                    tx.execute(
                        "UPDATE virtual_mr_sessions SET status='resolved', updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='open'",
                        [&run.session_id],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }
        let mut saved = run.clone();
        saved.published = true;
        tx.execute(
            "UPDATE ai_review_runs SET payload=?2 WHERE id=?1",
            params![
                run.id,
                serde_json::to_string(&saved).map_err(|e| e.to_string())?
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }
}

#[cfg(test)]
pub(crate) fn test_database(run: &ReviewRun) -> Database {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../core/db/schema.sql"))
        .unwrap();
    conn.execute(
        "INSERT INTO repositories(id,name,local_path) VALUES('repo','Fixture',?1)",
        [&run.snapshot.repo_path],
    )
    .unwrap();
    conn.execute("INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch) VALUES('session','repo','Fixture','main','feature')",[]).unwrap();
    Database::from_connection(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::review::{test_repo::TestRepo, ReviewFinding};
    #[test]
    fn mentions_allow_peer_replies_with_stable_author_identity_and_reject_stale_targets() {
        let repo = TestRepo::new();
        let (mut run, _) = repo.review();
        run.reviewer_id = Some("b".into());
        run.reviewer_name = Some("Bot B".into());
        run.status = "completed".into();
        run.decision = Some("comment".into());
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        db.conn().execute_batch("INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','a','Bot A'),('session','b','Bot B'); INSERT INTO virtual_mr_discussions(id,session_id) VALUES('thread','session'); INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('root','thread','ai_agent','a','Bot A','[@Bot B](#mr-mention/reviewer/b) please check this','2099-01-01','2099-01-01');").unwrap();
        let revision =
            crate::features::review::discussion_revision::current(&db.conn(), "thread").unwrap();
        let reply = |target: &str| ReviewDiscussionAction::Reply {
            discussion_id: "thread".into(),
            target_comment_id: target.into(),
            discussion_revision: revision.clone(),
            body: "[@Alice](#mr-mention/assignee/alice%40test) verified the concern.".into(),
        };
        assert!(db
            .publish_review_actions(&run, &[reply("missing")])
            .is_err());
        db.publish_review_actions(&run, &[reply("root")]).unwrap();
        let discussions = db.list_discussions("session").unwrap();
        assert_eq!(discussions[0].comments.len(), 2);
        assert_eq!(discussions[0].comments[0].id, "root");
        assert_eq!(discussions[0].comments[1].author_id, "b");
        assert!(discussions[0].comments[1]
            .body
            .contains("#mr-mention/assignee/alice%40test"));
        assert!(db.publish_review_actions(&run, &[reply("root")]).is_err());
        // A different timestamp representation must not reorder the actual conversation.
        db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('new-user','thread','user','alice@test','Alice','New question','2000-01-01','2000-01-01')", []).unwrap();
        assert_eq!(
            db.list_discussions("session").unwrap()[0]
                .comments
                .last()
                .unwrap()
                .id,
            "new-user"
        );
        assert!(db.publish_review_actions(&run, &[reply("root")]).is_err());
    }

    #[test]
    fn durable_state_and_idempotent_publishing_never_approve_or_resolve() {
        let repo = TestRepo::new();
        let (mut run, _) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        let mut duplicate = run.clone();
        duplicate.id = "another-run".into();
        assert!(db.save_review_run(&duplicate).is_err());
        run.status = "partial".into();
        run.findings.push(ReviewFinding {
            file_path: "source.rs".into(),
            side: "head".into(),
            start_line: 1,
            end_line: 1,
            severity: "medium".into(),
            title: "Fixture".into(),
            body: "Fixture finding".into(),
            evidence: "fn value() -> u32 { 2 }".into(),
        });
        db.save_review_run(&run).unwrap();
        db.review_event(
            &run.id,
            "tool_result",
            json!({"tool":"get_file_diff","isError":false}),
        )
        .unwrap();
        assert_eq!(db.list_review_runs("session").unwrap().len(), 1);
        db.publish_review(&run).unwrap();
        db.publish_review(&run).unwrap();
        assert!(db.get_review_run(&run.id).unwrap().published);
        let discussions = db.list_discussions("session").unwrap();
        assert_eq!(discussions.len(), 1);
        assert_eq!(discussions[0].comments.len(), 1);
        assert!(!discussions[0].is_resolved);
        assert_eq!(discussions[0].verification_status, "none");
        assert_eq!(
            discussions[0].commit_id.as_deref(),
            Some(run.snapshot.head_sha.as_str())
        );
        let status: String = db
            .conn()
            .query_row(
                "SELECT status FROM virtual_mr_sessions WHERE id='session'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(status, "open");
        assert_eq!(db.review_events(&run.id).unwrap().len(), 1);
        db.conn()
            .execute(
                "UPDATE ai_review_runs SET status='interrupted' WHERE id=?1",
                [&run.id],
            )
            .unwrap();
        assert_eq!(db.get_review_run(&run.id).unwrap().status, "interrupted");
        run.status = "failed".into();
        assert!(db.publish_review(&run).is_err());
    }
}
