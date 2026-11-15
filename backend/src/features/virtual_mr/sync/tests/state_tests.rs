use super::super::{persistence, review_state, worker};
use super::fixture::*;

#[test]
fn committed_ref_changes_update_all_matching_mrs_without_touching_history_or_checkout() {
    let (repo, db, mut run) = setup();
    approved(&db, &mut run);
    let first = scan(&repo, &db).remove(0);
    assert!(!first.needs_review);
    assert_eq!(first.session_status, "resolved");
    assert_eq!(first.reviewers["bot"], "approved");
    let history = db.get_review_run(&run.id).unwrap();
    db.conn().execute_batch("INSERT INTO virtual_mr_discussions(id,session_id,file_path,commit_id) VALUES('note','session','source.rs','original'); INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('comment','note','user','author','Author','Preserve this exact discussion','now','now');").unwrap();
    let discussions = serde_json::to_value(db.list_discussions("session").unwrap()).unwrap();
    repo.git(&["branch", "other"]);
    db.conn().execute_batch("INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch,status) VALUES('other','repo','Other','main','other','open');").unwrap();
    let before = scan(&repo, &db);
    let unchanged = before
        .iter()
        .find(|s| s.session_id == "other")
        .unwrap()
        .clone();
    commit(&repo);
    let status = repo.git(&["status", "--porcelain"]);
    let after = scan(&repo, &db);
    let changed = after.iter().find(|s| s.session_id == "session").unwrap();
    assert_ne!(changed.head_sha, first.head_sha);
    assert!(changed.revision > first.revision);
    assert!(changed.needs_review);
    assert_eq!(changed.reviewers["bot"], "pending");
    assert_eq!(changed.session_status, "open");
    assert_eq!(
        after.iter().find(|s| s.session_id == "other").unwrap(),
        &unchanged
    );
    assert_eq!(repo.git(&["status", "--porcelain"]), status);
    assert_eq!(
        db.get_review_run(&run.id).unwrap().snapshot.head_sha,
        history.snapshot.head_sha
    );
    assert!(db.get_review_run(&run.id).unwrap().published);
    assert_eq!(
        serde_json::to_value(db.list_discussions("session").unwrap()).unwrap(),
        discussions
    );
    assert!(
        db.publish_review_actions(&run, &[]).is_err(),
        "A stale approval must be rejected inside publication"
    );
    assert!(
        worker::verify_review(&db, &run).is_err(),
        "The live-ref guard must reject old snapshots too"
    );
}

#[test]
fn unsaved_and_uncommitted_edits_do_not_change_revision_but_deleted_refs_fail_closed() {
    let (repo, db, mut run) = setup();
    approved(&db, &mut run);
    let first = scan(&repo, &db);
    repo.write("source.rs", "uncommitted editor contents\n");
    assert_eq!(scan(&repo, &db), first);
    repo.git(&["update-ref", "-d", "refs/heads/feature"]);
    let state = scan(&repo, &db).remove(0);
    assert_eq!(state.ref_status, "unavailable");
    assert!(state.head_sha.is_none());
    assert!(state.needs_review);
    assert!(db.publish_review_actions(&run, &[]).is_err());
}

#[test]
fn stale_metadata_cannot_restore_approval_and_obsolete_jobs_cannot_rewrite_changed_branches() {
    let (repo, db, mut run) = setup();
    approved(&db, &mut run);
    scan(&repo, &db);
    let old = db.list_virtual_mr_sessions("repo").unwrap().remove(0);
    let stale = worker::groups(&db).unwrap().into_values().next().unwrap();
    commit(&repo);
    scan(&repo, &db);
    db.save_virtual_mr_session(&old).unwrap();
    let saved = db.list_virtual_mr_sessions("repo").unwrap().remove(0);
    assert_eq!(saved.status, "open");
    assert_eq!(saved.reviewers[0].review_status, "pending");
    db.conn()
        .execute(
            "UPDATE virtual_mr_sessions SET compare_branch='other' WHERE id='session'",
            [],
        )
        .unwrap();
    let refs = std::collections::HashMap::from([
        ("main".into(), Some(run.snapshot.base_sha.clone())),
        ("feature".into(), Some(run.snapshot.head_sha.clone())),
    ]);
    let before = persistence::list(&db, "repo").unwrap();
    persistence::apply(&db, &stale, &refs).unwrap();
    assert_eq!(persistence::list(&db, "repo").unwrap(), before);
    db.conn()
        .execute(
            "UPDATE virtual_mr_sessions SET status='closed' WHERE id='session'",
            [],
        )
        .unwrap();
    assert!(worker::groups(&db).unwrap().is_empty());
}

#[test]
fn a_fresh_completed_review_clears_staleness_and_metadata_revisions_remain_monotonic() {
    let (repo, db, mut run) = setup();
    approved(&db, &mut run);
    scan(&repo, &db);
    commit(&repo);
    let changed = scan(&repo, &db).remove(0);
    let (mut fresh, _) = repo.review();
    fresh.reviewer_id = Some("bot".into());
    db.save_review_run(&fresh).unwrap();
    fresh.status = "completed".into();
    fresh.decision = Some("approve".into());
    worker::verify_review(&db, &fresh).unwrap();
    db.publish_review_actions(&fresh, &[]).unwrap();
    let current = scan(&repo, &db).remove(0);
    assert!(!current.needs_review);
    assert_eq!(current.session_status, "resolved");
    assert!(current.revision > changed.revision);
    assert_eq!(scan(&repo, &db).remove(0), current);
    assert!(review_state::validate_publication(&db.conn(), &fresh).is_ok());
}

#[test]
fn offline_repositories_invalidate_old_verdicts_and_recover_without_rewriting_discussions() {
    let (repo, db, mut run) = setup();
    approved(&db, &mut run);
    scan(&repo, &db);
    let sessions = worker::groups(&db).unwrap().into_values().next().unwrap();
    let result = worker::scan(&db, repo.path(), &sessions, false, None).unwrap();
    let states = result.states;
    let success = result.healthy;
    assert!(success);
    assert_eq!(states[0].ref_status, "ready");
    let hidden = repo.path.join("hidden-git");
    std::fs::rename(repo.path.join(".git"), &hidden).unwrap();
    let result = worker::scan(&db, repo.path(), &sessions, false, None).unwrap();
    let states = result.states;
    let success = result.healthy;
    assert!(!success);
    assert_eq!(states[0].ref_status, "unavailable");
    assert!(states[0].needs_review);
    std::fs::rename(hidden, repo.path.join(".git")).unwrap();
    assert_eq!(scan(&repo, &db)[0].ref_status, "ready");
}

#[test]
fn cached_ref_checks_are_invalidated_by_reviewer_changes_but_not_other_repositories() {
    let (_repo, db, mut run) = setup();
    approved(&db, &mut run);
    let groups = worker::groups(&db).unwrap();
    let root = groups.keys().next().unwrap();
    let sessions = &groups[root];
    let first = worker::scan(&db, root, sessions, false, None).unwrap();
    db.conn().execute_batch("INSERT INTO repositories(id,name,local_path) VALUES('another','Another','/another'); INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch) VALUES('another','another','Another','main','feature');").unwrap();
    let cached = worker::scan(
        &db,
        root,
        sessions,
        false,
        Some((&first.states, &first.epochs)),
    )
    .unwrap();
    assert_eq!(cached.states, first.states);
    assert_eq!(cached.epochs, first.epochs);
    db.conn().execute("UPDATE virtual_mr_session_reviewers SET review_status='failed' WHERE session_id='session'",[]).unwrap();
    let fresh = worker::scan(
        &db,
        root,
        sessions,
        false,
        Some((&cached.states, &cached.epochs)),
    )
    .unwrap();
    assert_ne!(fresh.epochs, cached.epochs);
    assert_eq!(fresh.states[0].reviewers["bot"], "failed");
    assert!(fresh.states[0].revision > cached.states[0].revision);
}

#[test]
fn schema_upgrade_is_idempotent_and_repository_deletion_cleans_sync_data() {
    let (repo, db, _run) = setup();
    scan(&repo, &db);
    db.conn()
        .execute_batch("ALTER TABLE virtual_mr_ref_state DROP COLUMN view_digest;")
        .unwrap();
    super::super::migration::migrate(&db.conn()).unwrap();
    super::super::migration::migrate(&db.conn()).unwrap();
    assert_eq!(persistence::list(&db, "repo").unwrap().len(), 1);
    db.conn()
        .execute("DELETE FROM repositories WHERE id='repo'", [])
        .unwrap();
    assert_eq!(
        db.conn()
            .query_row("SELECT COUNT(*) FROM virtual_mr_ref_state", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        db.conn()
            .query_row("SELECT COUNT(*) FROM virtual_mr_sync_epochs", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}
