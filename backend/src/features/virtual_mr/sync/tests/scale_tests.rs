use super::super::worker;
use super::fixture::*;
use std::{
    process::Command,
    time::{Duration, Instant},
};

#[test]
fn a_thousand_mrs_share_batched_git_reads_and_unchanged_scans_do_not_write_sqlite() {
    let (repo, db, run) = setup();
    let input = (0..1000)
        .map(|n| format!("create refs/heads/batch-{n} {}\n", run.snapshot.head_sha))
        .collect::<String>();
    let mut command = Command::new("git");
    command
        .current_dir(repo.path())
        .args(["-c", "core.hooksPath=", "update-ref", "--stdin"]);
    let result = crate::common::process::run_bounded_command_with_input(
        &mut command,
        input.into_bytes(),
        1024,
        1024,
        Duration::from_secs(15),
    )
    .unwrap();
    assert!(result.status.success());
    db.conn()
        .execute_batch("DELETE FROM virtual_mr_sessions;")
        .unwrap();
    {
        let mut conn = db.conn();
        let tx = conn.transaction().unwrap();
        for n in 0..1000 {
            tx.execute("INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch) VALUES(?1,'repo','Scale fixture','main',?2)",rusqlite::params![format!("mr-{n}"),format!("batch-{n}")]).unwrap();
        }
        tx.commit().unwrap();
    }
    let groups = worker::groups(&db).unwrap();
    let root = groups.keys().next().unwrap();
    let start = Instant::now();
    let result = worker::scan(&db, root, &groups[root], false, None).unwrap();
    let initial = start.elapsed();
    let first = result.states;
    assert_eq!(first.len(), 1000);
    let changes = db.conn().total_changes();
    let start = Instant::now();
    let mut second = worker::scan(
        &db,
        root,
        &groups[root],
        false,
        Some((&first, &result.epochs)),
    )
    .unwrap()
    .states;
    let unchanged = start.elapsed();
    assert_eq!(
        db.conn().total_changes(),
        changes,
        "An unchanged scan must not write persistent state"
    );
    let mut first = first;
    first.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    second.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    assert_eq!(first, second);
    let groups = worker::groups(&db).unwrap();
    assert_eq!(
        groups.len(),
        1,
        "MR count must not multiply repository subscriptions"
    );
    repo.git(&["update-ref", "refs/heads/batch-0", &run.snapshot.base_sha]);
    let updated = scan(&repo, &db);
    assert_eq!(
        updated
            .iter()
            .filter(|s| first
                .iter()
                .find(|old| old.session_id == s.session_id)
                .unwrap()
                .revision
                != s.revision)
            .count(),
        1
    );
    eprintln!(
        "MR sync fixture: 1000 MRs, one repository; initial={initial:?}, unchanged={unchanged:?}"
    );
}
