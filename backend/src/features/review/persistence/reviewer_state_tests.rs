use super::{recover_reviewer_states, sync_run_state};
use crate::core::db::Database;
use crate::features::review::{persistence::test_database, test_repo::TestRepo, ReviewRun};

fn fixture() -> (TestRepo, ReviewRun, Database) {
    let repo = TestRepo::new();
    let (mut run, _) = repo.review();
    run.reviewer_id = Some("bot".into());
    let db = test_database(&run);
    db.conn().execute("INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','bot','Bot')", []).unwrap();
    (repo, run, db)
}

fn status(db: &Database) -> String {
    db.conn()
        .query_row(
            "SELECT review_status FROM virtual_mr_session_reviewers WHERE agent_id='bot'",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn unsuccessful_runs_persist_their_actual_state_and_can_retry() {
    for terminal in ["failed", "incomplete", "cancelled", "interrupted"] {
        let (_repo, mut run, db) = fixture();
        db.save_review_run(&run).unwrap();
        assert_eq!(status(&db), "reviewing");
        run.status = terminal.into();
        run.error = Some("Provider disconnected".into());
        run.decision = Some("approve".into());
        db.save_review_run(&run).unwrap();
        assert_eq!(status(&db), terminal);
        assert_eq!(
            db.list_virtual_mr_sessions("repo").unwrap()[0].reviewers[0].review_status,
            terminal
        );
        let mut retry = run.clone();
        retry.id = "retry".into();
        retry.status = "running".into();
        db.save_review_run(&retry).unwrap();
        assert_eq!(status(&db), "reviewing");
    }
}

#[test]
fn unsuccessful_replies_do_not_replace_the_full_review_verdict() {
    for terminal in [
        "running",
        "failed",
        "incomplete",
        "cancelled",
        "interrupted",
    ] {
        let (_repo, mut run, db) = fixture();
        db.conn()
            .execute(
                "UPDATE virtual_mr_session_reviewers SET review_status='approved'",
                [],
            )
            .unwrap();
        run.reply_discussion_id = Some("thread".into());
        run.status = terminal.into();
        db.save_review_run(&run).unwrap();
        assert_eq!(status(&db), "approved");
    }
}

#[test]
fn saving_success_does_not_bypass_guarded_verdict_publication() {
    let (_repo, mut run, db) = fixture();
    db.save_review_run(&run).unwrap();
    run.status = "completed".into();
    run.decision = Some("approve".into());
    db.save_review_run(&run).unwrap();
    assert_eq!(status(&db), "reviewing");
    db.publish_review(&run).unwrap();
    assert_eq!(status(&db), "approved");
}

#[test]
fn old_completions_cannot_overwrite_a_newer_full_review() {
    let (_repo, mut old, db) = fixture();
    old.status = "failed".into();
    db.save_review_run(&old).unwrap();
    let mut new = old.clone();
    new.id = "new".into();
    new.status = "running".into();
    db.save_review_run(&new).unwrap();
    db.save_review_run(&old).unwrap();
    assert_eq!(status(&db), "reviewing");
    new.status = "completed".into();
    new.decision = Some("approve".into());
    db.save_review_run(&new).unwrap();
    db.publish_review(&new).unwrap();
    db.save_review_run(&old).unwrap();
    assert_eq!(status(&db), "approved");
}

#[test]
fn run_and_assignment_writes_roll_back_together_on_storage_failure() {
    let (_repo, mut run, db) = fixture();
    db.save_review_run(&run).unwrap();
    db.conn()
        .execute_batch(
            "CREATE TRIGGER reject_badge BEFORE UPDATE ON virtual_mr_session_reviewers
        WHEN NEW.review_status='failed' BEGIN SELECT RAISE(ABORT,'Storage unavailable'); END;",
        )
        .unwrap();
    run.status = "failed".into();
    assert!(db.save_review_run(&run).is_err());
    assert_eq!(db.get_review_run(&run.id).unwrap().status, "running");
    assert_eq!(status(&db), "reviewing");
}

#[test]
fn startup_recovers_interrupted_badges_but_preserves_deliberate_pending_resets() {
    let (_repo, run, db) = fixture();
    db.save_review_run(&run).unwrap();
    db.conn()
        .execute("UPDATE ai_review_runs SET status='interrupted'", [])
        .unwrap();
    recover_reviewer_states(&db.conn()).unwrap();
    assert_eq!(status(&db), "interrupted");
    for retained in ["pending", "approved", "changes_requested"] {
        db.conn()
            .execute(
                "UPDATE virtual_mr_session_reviewers SET review_status=?1",
                [retained],
            )
            .unwrap();
        recover_reviewer_states(&db.conn()).unwrap();
        assert_eq!(status(&db), retained);
    }
    // A newer reply is irrelevant to the assignment's full-review state.
    let mut reply = run.clone();
    reply.id = "reply".into();
    reply.status = "failed".into();
    reply.reply_discussion_id = Some("thread".into());
    db.save_review_run(&reply).unwrap();
    db.conn()
        .execute(
            "UPDATE virtual_mr_session_reviewers SET review_status='reviewing'",
            [],
        )
        .unwrap();
    let mut interrupted = run.clone();
    interrupted.status = "interrupted".into();
    sync_run_state(&db.conn(), &interrupted, true).unwrap();
    assert_eq!(status(&db), "interrupted");
}
