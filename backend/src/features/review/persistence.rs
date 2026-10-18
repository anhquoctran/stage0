use super::ReviewRun;
use crate::core::db::Database;
use rusqlite::params;
use serde_json::{json, Value};

impl Database {
    pub fn save_review_run(&self, run: &ReviewRun) -> Result<(), String> {
        let payload = serde_json::to_string(run).map_err(|_| "Could not serialize review run")?;
        self.conn().execute("INSERT INTO ai_review_runs(id,session_id,status,payload,started_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",params![run.id,run.session_id,run.status,payload,run.started_at]).map_err(|e|format!("Could not save review state: {e}"))?;
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
            .map_err(|_| "Review run not found")?;
        let mut run: ReviewRun =
            serde_json::from_str(&payload).map_err(|_| "Invalid stored review run")?;
        if status == "interrupted" {
            run.status = status;
            run.error=Some("Application stopped before this run finished. Start a new review; it was not completed or approved.".into());
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
        if !matches!(run.status.as_str(), "completed" | "partial") {
            return Err("Only finished review findings may be published".into());
        }
        let mut conn = self.conn();
        let tx = conn.transaction().map_err(|e| e.to_string())?;
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
            let body=format!("**[{}] {}**\n\n{}\n\nEvidence from `{}` lines {}–{}:\n\n```\n{}\n```\n\nReview run `{}` · {} · {}. This is a model finding, not an approval.",finding.severity,finding.title,finding.body,sha,finding.start_line,finding.end_line,finding.evidence,run.id,run.provider,run.model);
            tx.execute("INSERT OR IGNORE INTO virtual_mr_discussions(id,session_id,file_path,diff_side,line_number,commit_id,is_resolved,resolve_type,verification_status,created_at) VALUES(?1,?2,?3,?4,?5,?6,0,'manual','none',?7)",params![id,run.session_id,finding.file_path,side,finding.start_line as i64,sha,run.started_at]).map_err(|e|e.to_string())?;
            tx.execute("INSERT OR IGNORE INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,review_action,created_at,updated_at) VALUES(?1,?2,'ai_agent',?3,?4,?5,'comment',?6,?6)",params![format!("{id}-comment"),id,run.id,format!("Stage0 AI ({})",run.model),body,run.started_at]).map_err(|e|e.to_string())?;
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
    Database(std::sync::Mutex::new(conn))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::review::{test_repo::TestRepo, ReviewFinding};
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
