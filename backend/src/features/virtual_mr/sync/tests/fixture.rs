pub(super) use crate::core::db::Database;
pub(super) use crate::features::review::{test_repo::TestRepo, ReviewRun};

pub(super) fn setup() -> (TestRepo, Database, ReviewRun) {
    let repo = TestRepo::new();
    let (run, _) = repo.review();
    let db = crate::features::review::persistence::test_database(&run);
    db.conn().execute_batch("PRAGMA foreign_keys=ON;CREATE UNIQUE INDEX idx_fixture_open_pair ON virtual_mr_sessions(repo_id,base_branch,compare_branch) WHERE status='open';INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','bot','Bot');").unwrap();
    (repo, db, run)
}

pub(super) fn approved(db: &Database, run: &mut ReviewRun) {
    run.reviewer_id = Some("bot".into());
    run.status = "completed".into();
    run.decision = Some("approve".into());
    db.save_review_run(run).unwrap();
    db.publish_review_actions(run, &[]).unwrap();
    run.published = true;
}

pub(super) fn scan(repo: &TestRepo, db: &Database) -> Vec<super::super::state::MrSyncState> {
    let groups = super::super::worker::groups(db).unwrap();
    let root = dunce::canonicalize(&repo.path)
        .unwrap()
        .to_string_lossy()
        .into_owned();
    super::super::worker::scan(db, &root, &groups[&root], false, None)
        .unwrap()
        .states
}

pub(super) fn commit(repo: &TestRepo) {
    repo.write("source.rs", "fn value() -> u32 { 3 }\n");
    repo.git(&["add", "source.rs"]);
    repo.git(&["commit", "-m", "Fix after review"]);
}
