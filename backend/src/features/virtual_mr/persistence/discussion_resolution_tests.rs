use crate::core::db::Database;
use rusqlite::Connection;

fn seed(conn: Connection) -> Database {
    conn.execute_batch(include_str!("../../../core/db/schema.sql"))
        .unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;
        INSERT INTO repositories(id,name,local_path) VALUES('repo','Repo','/fixture');
        INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch) VALUES('mr','repo','MR','main','topic'),('other','repo','Other','main','other');
        INSERT INTO virtual_mr_discussions(id,session_id,file_path) VALUES('thread','mr','src/cart.ts');
        INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body) VALUES('root','thread','ai_agent','tester','Stage0 AI (Tester)','Original private finding body');").unwrap();
    Database::from_connection(conn)
}

#[test]
fn manual_bot_resolution_records_durable_actor_target_and_real_transitions_only() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("resolution.db");
    {
        let db = seed(Connection::open(&path).unwrap());
        db.resolve_discussion_with_activity("thread", true, "manual", "alice@test", "Alice")
            .unwrap();
        let events = db.list_mr_discussion_activity("mr").unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].action, "resolved");
        assert_eq!(events[0].actor_id, "alice@test");
        assert_eq!(events[0].actor_name, "Alice");
        assert_eq!(events[0].reviewer_name, "Stage0 AI (Tester)");
        assert_eq!(events[0].discussion_id, "thread");
        assert_eq!(events[0].file_path.as_deref(), Some("src/cart.ts"));
        assert!(chrono::DateTime::parse_from_rfc3339(&events[0].created_at).is_ok());
        assert!(!serde_json::to_string(&events)
            .unwrap()
            .contains("Original private finding body"));
        db.resolve_discussion_with_activity("thread", true, "manual", "bob@test", "Bob")
            .unwrap();
        assert_eq!(db.list_mr_discussion_activity("mr").unwrap().len(), 1);
        assert_eq!(
            db.list_discussions("mr").unwrap()[0].resolved_by.as_deref(),
            Some("Alice")
        );
        db.resolve_discussion_with_activity("thread", false, "manual", "bob@test", "Bob")
            .unwrap();
        db.resolve_discussion_with_activity("thread", false, "manual", "bob@test", "Bob")
            .unwrap();
        db.resolve_discussion_with_activity("thread", true, "manual", "alice@test", "Alice")
            .unwrap();
        assert_eq!(
            db.list_mr_discussion_activity("mr")
                .unwrap()
                .iter()
                .map(|event| event.action.as_str())
                .collect::<Vec<_>>(),
            ["resolved", "reopened", "resolved"]
        );
        assert!(db.list_mr_discussion_activity("other").unwrap().is_empty());
        db.conn()
            .execute("DELETE FROM virtual_mr_discussions WHERE id='thread'", [])
            .unwrap();
    }
    let db = Database::from_connection(Connection::open(path).unwrap());
    assert_eq!(db.list_mr_discussion_activity("mr").unwrap().len(), 3);
}

#[test]
fn failed_audit_writes_roll_back_resolution_and_do_not_leave_success_history() {
    let db = seed(Connection::open_in_memory().unwrap());
    db.conn().execute_batch("CREATE TRIGGER fail_resolution_activity BEFORE INSERT ON virtual_mr_discussion_activity BEGIN SELECT RAISE(ABORT,'fixture failure'); END;").unwrap();
    assert!(db
        .resolve_discussion_with_activity("thread", true, "manual", "alice@test", "Alice")
        .is_err());
    let thread = &db.list_discussions("mr").unwrap()[0];
    assert!(!thread.is_resolved);
    assert!(thread.resolved_by.is_none());
    assert!(db.list_mr_discussion_activity("mr").unwrap().is_empty());
    assert!(db
        .resolve_discussion_with_activity("missing", true, "manual", "alice@test", "Alice")
        .is_err());
}

#[test]
fn human_threads_with_bot_replies_do_not_become_bot_review_discussions() {
    let db = seed(Connection::open_in_memory().unwrap());
    db.conn().execute_batch("UPDATE virtual_mr_comments SET author_type='user' WHERE id='root'; INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body) VALUES('bot-reply','thread','ai_agent','tester','Tester','Reply');").unwrap();
    db.resolve_discussion_with_activity("thread", true, "manual", "alice@test", "Alice")
        .unwrap();
    assert!(db.list_discussions("mr").unwrap()[0].is_resolved);
    assert!(db.list_mr_discussion_activity("mr").unwrap().is_empty());
}
