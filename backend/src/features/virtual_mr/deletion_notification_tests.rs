use crate::core::db::Database;
use crate::features::virtual_mr::discussion_deletion::delete_and_notify;
use rusqlite::Connection;
use std::cell::Cell;

#[test]
fn only_committed_deletions_notify_once_and_permission_failure_preserves_success() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().to_str().unwrap();
    for args in [
        vec!["init", "--quiet"],
        vec!["config", "user.email", "alice@example.test"],
    ] {
        assert!(std::process::Command::new("git")
            .arg("-C")
            .arg(path)
            .args(args)
            .status()
            .unwrap()
            .success());
    }
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../core/db/schema.sql"))
        .unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys=ON;
        INSERT INTO repositories(id,name,local_path) VALUES('repo','Repo','/placeholder');
        INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch)
            VALUES('mr','repo','Example MR','main','topic');
        INSERT INTO virtual_mr_discussions(id,session_id) VALUES('thread','mr');
        INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body)
            VALUES('root','thread','user','alice@example.test','Alice','Body');",
    )
    .unwrap();
    conn.execute("UPDATE repositories SET local_path=?1", [path])
        .unwrap();
    let db = Database::from_connection(conn);
    let notifications = Cell::new(0);

    // A failed transaction cannot notify, including a failure after audit insertion.
    db.conn()
        .execute_batch(
            "CREATE TRIGGER fail_delete BEFORE DELETE ON virtual_mr_discussions
        BEGIN SELECT RAISE(ABORT,'Disk error'); END;",
        )
        .unwrap();
    assert!(delete_and_notify(&db, "root", |_| {
        notifications.set(notifications.get() + 1);
        Ok(())
    })
    .is_err());
    assert_eq!(notifications.get(), 0);
    assert!(db.list_mr_deletion_activity("mr").unwrap().is_empty());
    db.conn()
        .execute_batch("DROP TRIGGER fail_delete;")
        .unwrap();

    let result = delete_and_notify(&db, "root", |outcome| {
        notifications.set(notifications.get() + 1);
        // A fresh reader sees committed history and no deleted content before delivery.
        assert!(db.list_discussions("mr").unwrap().is_empty());
        assert_eq!(
            db.list_mr_deletion_activity("mr").unwrap()[0].id,
            outcome.activity.id
        );
        Err("OS permission denied".into())
    })
    .unwrap();
    assert!(result.deleted_discussion);
    assert_eq!(notifications.get(), 1);
    assert_eq!(db.list_mr_deletion_activity("mr").unwrap().len(), 1);
    assert!(delete_and_notify(&db, "root", |_| {
        notifications.set(notifications.get() + 1);
        Ok(())
    })
    .is_err());
    assert_eq!(notifications.get(), 1);
}
