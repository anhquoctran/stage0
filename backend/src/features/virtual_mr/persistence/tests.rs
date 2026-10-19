use super::{Database, VirtualMrReviewerDb, VirtualMrSessionDb};
use rusqlite::Connection;
use std::sync::Mutex;

fn seed(conn: &Connection) {
    conn.execute_batch(include_str!("../../../core/db/schema.sql"))
        .unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         INSERT INTO repositories(id,name,local_path) VALUES('repo-a','A','/fixture/a'),('repo-b','B','/fixture/b');
         INSERT INTO repo_labels(id,repo_id,name,color) VALUES('bug','repo-a','Bug','#ff0000'),('feature','repo-a','Feature','#0000ff');",
    ).unwrap();
}

fn session(id: &str, repo_id: &str) -> VirtualMrSessionDb {
    VirtualMrSessionDb {
        id: id.into(),
        repo_id: repo_id.into(),
        title: "Fixture MR".into(),
        description: Some("Fixture description".into()),
        base_branch: "main".into(),
        compare_branch: "feature".into(),
        status: "open".into(),
        assignee_name: Some("User".into()),
        assignee_email: Some("user@example.test".into()),
        is_pinned: false,
        sandbox_adapter_type: "in_memory".into(),
        sandbox_instance_id: None,
        created_at: String::new(),
        updated_at: String::new(),
        label_ids: vec![],
        reviewers: vec![],
    }
}

fn reviewer() -> VirtualMrReviewerDb {
    VirtualMrReviewerDb {
        agent_id: "reviewer-1".into(),
        agent_name: "Reviewer 01".into(),
        review_status: "pending".into(),
        assigned_at: "2026-10-18T00:00:00Z".into(),
    }
}

#[test]
fn reviewers_and_labels_survive_database_reopen_and_removal() {
    let path = std::env::temp_dir().join(format!("stage0-mr-metadata-{}.db", uuid::Uuid::new_v4()));
    let mut expected = session("mr-a", "repo-a");
    expected.label_ids = vec!["bug".into()];
    expected.reviewers = vec![reviewer()];
    {
        let conn = Connection::open(&path).unwrap();
        seed(&conn);
        let db = Database(Mutex::new(conn));
        db.save_virtual_mr_session(&expected).unwrap();
        let mut other = session("mr-b", "repo-b");
        other.reviewers = vec![reviewer()];
        db.save_virtual_mr_session(&other).unwrap();
    }
    {
        let db = Database(Mutex::new(Connection::open(&path).unwrap()));
        let sessions = db.list_virtual_mr_sessions("repo-a").unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "mr-a");
        assert_eq!(sessions[0].label_ids, expected.label_ids);
        assert_eq!(sessions[0].reviewers, expected.reviewers);
        let mut edited = sessions[0].clone();
        edited.title = "Updated title".into();
        db.save_virtual_mr_session(&edited).unwrap();
        let loaded = db.list_virtual_mr_sessions("repo-a").unwrap().remove(0);
        assert_eq!(loaded.reviewers, expected.reviewers);
        assert_eq!(loaded.label_ids, expected.label_ids);
        edited.reviewers.clear();
        edited.label_ids.clear();
        db.save_virtual_mr_session(&edited).unwrap();
    }
    {
        let db = Database(Mutex::new(Connection::open(&path).unwrap()));
        let loaded = db.list_virtual_mr_sessions("repo-a").unwrap().remove(0);
        assert!(loaded.reviewers.is_empty());
        assert!(loaded.label_ids.is_empty());
        assert_eq!(loaded.title, "Updated title");
        assert_eq!(
            db.list_virtual_mr_sessions("repo-b").unwrap()[0].reviewers,
            vec![reviewer()]
        );
    }
    std::fs::remove_file(path).unwrap();
}

#[test]
fn failed_metadata_update_rolls_back_session_labels_and_reviewers_together() {
    let conn = Connection::open_in_memory().unwrap();
    seed(&conn);
    let db = Database(Mutex::new(conn));
    let mut original = session("mr-a", "repo-a");
    original.label_ids = vec!["bug".into()];
    original.reviewers = vec![reviewer()];
    db.save_virtual_mr_session(&original).unwrap();
    let mut invalid = original.clone();
    invalid.title = "Must roll back".into();
    invalid.label_ids = vec!["feature".into()];
    invalid.reviewers.push(reviewer());
    assert!(db.save_virtual_mr_session(&invalid).is_err());
    let loaded = db.list_virtual_mr_sessions("repo-a").unwrap().remove(0);
    assert_eq!(loaded.title, original.title);
    assert_eq!(loaded.label_ids, original.label_ids);
    assert_eq!(loaded.reviewers, original.reviewers);
}

#[test]
fn old_session_payload_without_reviewers_is_still_readable() {
    let mut payload = serde_json::to_value(session("mr", "repo-a")).unwrap();
    payload.as_object_mut().unwrap().remove("reviewers");
    let loaded: VirtualMrSessionDb = serde_json::from_value(payload).unwrap();
    assert!(loaded.reviewers.is_empty());
}
