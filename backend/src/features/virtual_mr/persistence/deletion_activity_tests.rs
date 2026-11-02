use crate::core::db::Database;
use crate::features::virtual_mr::discussion_deletion::delete_for_author;
use rusqlite::Connection;

const SCHEMA: &str = include_str!("../../../core/db/schema.sql");
const AUTHOR: &str = "alice@example.test";

fn seed(conn: Connection) -> Database {
    conn.execute_batch(SCHEMA).unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;
        INSERT INTO repositories(id,name,local_path) VALUES('repo','Repo','/fixture');
        INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch)
            VALUES('mr','repo','Example MR','main','topic'),('other','repo','Other MR','main','other');
        INSERT INTO virtual_mr_discussions(id,session_id) VALUES('thread','mr');
        INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body)
            VALUES('root','thread','user','alice@example.test','Alice','Sensitive deleted body');")
        .unwrap();
    Database::from_connection(conn)
}

#[test]
fn deleting_root_keeps_durable_activity_after_reopening_without_retaining_the_body() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("activity.db");
    let event_id;
    {
        let db = seed(Connection::open(&path).unwrap());
        let outcome = delete_for_author(&db, "mr", "root", AUTHOR).unwrap();
        assert!(outcome.deleted_discussion);
        assert_eq!(outcome.session_title, "Example MR");
        assert!(db.list_discussions("mr").unwrap().is_empty());
        let events = db.list_mr_deletion_activity("mr").unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, outcome.activity.id);
        assert_eq!(events[0].actor_id, AUTHOR);
        assert_eq!(events[0].actor_name, "Alice");
        assert_eq!(events[0].target_kind, "discussion");
        assert_eq!(events[0].discussion_id, "thread");
        assert_eq!(events[0].comment_id, "root");
        assert!(chrono::DateTime::parse_from_rfc3339(&events[0].created_at).is_ok());
        assert!(db.list_mr_deletion_activity("other").unwrap().is_empty());
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(!json.contains("Sensitive deleted body"));
        assert!(!json.contains("sessionTitle"));
        event_id = events[0].id.clone();
        // Retrying an already deleted target cannot duplicate the audit record.
        assert!(delete_for_author(&db, "mr", "root", AUTHOR).is_err());
        assert_eq!(db.list_mr_deletion_activity("mr").unwrap().len(), 1);
    }
    let db = Database::from_connection(Connection::open(&path).unwrap());
    assert_eq!(db.list_mr_deletion_activity("mr").unwrap()[0].id, event_id);
}

#[test]
fn reply_deletion_keeps_its_parent_and_records_a_separate_event() {
    let db = seed(Connection::open_in_memory().unwrap());
    db.conn()
        .execute_batch(
            "INSERT INTO virtual_mr_comments
        (id,discussion_id,author_type,author_id,author_name,body)
        VALUES('reply','thread','user','alice@example.test','Alice','Reply body');",
        )
        .unwrap();
    let reply = delete_for_author(&db, "mr", "reply", AUTHOR).unwrap();
    assert!(!reply.deleted_discussion);
    assert_eq!(reply.activity.target_kind, "reply");
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments[0].id, "root");
    let root = delete_for_author(&db, "mr", "root", AUTHOR).unwrap();
    let events = db.list_mr_deletion_activity("mr").unwrap();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].id, reply.activity.id);
    assert_eq!(events[1].id, root.activity.id);
}

#[test]
fn rejected_deletions_do_not_leave_success_activity() {
    let db = seed(Connection::open_in_memory().unwrap());
    assert!(delete_for_author(&db, "mr", "root", "other@example.test").is_err());
    assert!(db.list_mr_deletion_activity("mr").unwrap().is_empty());
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments.len(), 1);
}

#[test]
fn audit_insert_or_delete_failure_rolls_back_both_content_and_history() {
    for trigger in [
        "CREATE TRIGGER fail_write BEFORE INSERT ON virtual_mr_deletion_activity
         BEGIN SELECT RAISE(ABORT,'Storage unavailable'); END;",
        "CREATE TRIGGER fail_delete BEFORE DELETE ON virtual_mr_discussions
         BEGIN SELECT RAISE(ABORT,'Deletion blocked'); END;",
    ] {
        let db = seed(Connection::open_in_memory().unwrap());
        db.conn().execute_batch(trigger).unwrap();
        assert!(delete_for_author(&db, "mr", "root", AUTHOR).is_err());
        assert_eq!(db.list_discussions("mr").unwrap()[0].comments.len(), 1);
        assert!(db.list_mr_deletion_activity("mr").unwrap().is_empty());
    }
}

#[test]
fn existing_databases_gain_the_new_table_idempotently() {
    let db = seed(Connection::open_in_memory().unwrap());
    db.conn()
        .execute_batch("DROP TABLE virtual_mr_deletion_activity;")
        .unwrap();
    db.conn().execute_batch(SCHEMA).unwrap();
    db.conn().execute_batch(SCHEMA).unwrap();
    delete_for_author(&db, "mr", "root", AUTHOR).unwrap();
    assert_eq!(db.list_mr_deletion_activity("mr").unwrap().len(), 1);
}
