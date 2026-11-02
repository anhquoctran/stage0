use super::deletable_comments;
use crate::core::db::Database;
use crate::features::virtual_mr::discussion_deletion::delete_for_author;
use rusqlite::{params, Connection};

const EMAIL: &str = "alice@example.test";

fn fixture() -> Database {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../core/db/schema.sql"))
        .unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;
        INSERT INTO repositories(id,name,local_path) VALUES('repo','Repo','/fixture');
        INSERT INTO virtual_mr_sessions(id,repo_id,title,base_branch,compare_branch)
            VALUES('mr','repo','MR','main','topic'),('other','repo','Other','main','other');
        INSERT INTO virtual_mr_discussions(id,session_id) VALUES('thread','mr'),('quotes','other');")
        .unwrap();
    let db = Database::from_connection(conn);
    comment(&db, "root", "thread", "user", EMAIL, "Root");
    db
}

fn comment(db: &Database, id: &str, discussion: &str, kind: &str, author: &str, body: &str) {
    db.conn()
        .execute(
            "INSERT INTO virtual_mr_comments
        (id,discussion_id,author_type,author_id,author_name,body) VALUES(?1,?2,?3,?4,'Alice',?5)",
            params![id, discussion, kind, author, body],
        )
        .unwrap();
}

fn allowed(db: &Database) -> Vec<String> {
    let mut ids: Vec<_> = deletable_comments(&db.conn(), "mr", EMAIL)
        .unwrap()
        .into_iter()
        .collect();
    ids.sort();
    ids
}

#[test]
fn unreferenced_own_discussion_is_deleted_with_its_root() {
    let db = fixture();
    assert_eq!(allowed(&db), ["root"]);
    let result = delete_for_author(&db, "mr", "root", EMAIL).unwrap();
    assert_eq!(result["deletedDiscussion"], true);
    assert_eq!(result["discussionId"], "thread");
    assert!(db.list_discussions("mr").unwrap().is_empty());
    let count: i64 = db
        .conn()
        .query_row("SELECT count(*) FROM virtual_mr_comments", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn ownership_is_email_based_and_never_grants_ai_or_other_users_access() {
    let db = fixture();
    for email in ["bob@example.test", "", " "] {
        assert!(delete_for_author(&db, "mr", "root", email).is_err());
    }
    db.conn()
        .execute("UPDATE virtual_mr_comments SET author_type='ai_agent'", [])
        .unwrap();
    assert!(allowed(&db).is_empty());
    assert!(delete_for_author(&db, "mr", "root", EMAIL).is_err());
    db.conn()
        .execute(
            "UPDATE virtual_mr_comments SET author_type='user',author_id=' Alice@Example.Test '",
            [],
        )
        .unwrap();
    assert_eq!(allowed(&db), ["root"]);
}

#[test]
fn replies_protect_roots_and_earlier_comments_even_at_identical_timestamps() {
    let db = fixture();
    comment(&db, "reply", "thread", "user", EMAIL, "First reply");
    assert_eq!(allowed(&db), ["reply"]);
    assert!(delete_for_author(&db, "mr", "root", EMAIL).is_err());
    comment(&db, "later", "thread", "ai_agent", "bot", "Bot reply");
    assert!(allowed(&db).is_empty());
    assert!(delete_for_author(&db, "mr", "reply", EMAIL).is_err());
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments.len(), 3);
}

#[test]
fn deleting_last_reply_preserves_root_and_enables_it_again() {
    let db = fixture();
    comment(&db, "reply", "thread", "user", EMAIL, "Last reply");
    let result = delete_for_author(&db, "mr", "reply", EMAIL).unwrap();
    assert_eq!(result["deletedDiscussion"], false);
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments[0].id, "root");
    assert_eq!(allowed(&db), ["root"]);
}

#[test]
fn cross_mr_comment_and_discussion_quotes_block_deletion_by_any_author() {
    for target in [
        "#mr-comment/root",
        "#mr-discussion/thread",
        "#mr-comment/%72oot",
    ] {
        for author in [EMAIL, "bob@example.test", "bot"] {
            let db = fixture();
            comment(
                &db,
                "quote",
                "quotes",
                "user",
                author,
                &format!("> [Quoted]({target})"),
            );
            assert!(allowed(&db).is_empty(), "{target} {author}");
            assert!(delete_for_author(&db, "mr", "root", EMAIL).is_err());
        }
    }
}

#[test]
fn reference_ids_match_exactly_and_decode_unicode() {
    let db = fixture();
    comment(
        &db,
        "quote",
        "quotes",
        "user",
        EMAIL,
        "[Other](#mr-comment/root-other)",
    );
    assert_eq!(allowed(&db), ["root"]);
    db.conn()
        .execute(
            "UPDATE virtual_mr_comments SET id='r\u{1ed9}ot' WHERE id='root'",
            [],
        )
        .unwrap();
    db.conn().execute("UPDATE virtual_mr_comments SET body='[Quote](#mr-comment/r%E1%BB%99ot)' WHERE id='quote'", []).unwrap();
    assert!(allowed(&db).is_empty());
}

#[test]
fn description_quotes_and_new_replies_recheck_stale_permissions() {
    let db = fixture();
    assert_eq!(allowed(&db), ["root"]);
    db.conn().execute("UPDATE virtual_mr_sessions SET description='[Quote](#mr-discussion/thread)' WHERE id='other'", []).unwrap();
    assert!(delete_for_author(&db, "mr", "root", EMAIL).is_err());
    db.conn()
        .execute("UPDATE virtual_mr_sessions SET description=NULL", [])
        .unwrap();
    assert_eq!(allowed(&db), ["root"]);
    comment(
        &db,
        "new",
        "thread",
        "user",
        "bob@example.test",
        "Just posted",
    );
    assert!(delete_for_author(&db, "mr", "root", EMAIL).is_err());
    assert!(delete_for_author(&db, "other", "new", "bob@example.test").is_err());
    assert!(delete_for_author(&db, "mr", "missing", EMAIL).is_err());
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments.len(), 2);
}

#[test]
fn legacy_local_comments_follow_existing_identity_mapping_but_unknown_identity_fails_closed() {
    let db = fixture();
    db.conn()
        .execute(
            "UPDATE virtual_mr_comments SET author_id='user@local.stage0',author_name='Local User'",
            [],
        )
        .unwrap();
    assert_eq!(allowed(&db), ["root"]);
    assert!(deletable_comments(&db.conn(), "mr", "").unwrap().is_empty());
    assert!(delete_for_author(&db, "mr", "root", "").is_err());
}

#[test]
fn permission_hints_and_public_deletion_use_repository_git_identity() {
    use crate::features::virtual_mr::discussion_deletion::{delete, with_permissions};
    let db = fixture();
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().to_str().unwrap();
    for args in [vec!["init", "--quiet"], vec!["config", "user.email", EMAIL]] {
        assert!(std::process::Command::new("git")
            .arg("-C")
            .arg(path)
            .args(args)
            .status()
            .unwrap()
            .success());
    }
    db.conn()
        .execute("UPDATE repositories SET local_path=?1", [path])
        .unwrap();
    let payload = with_permissions(&db, "mr", db.list_discussions("mr").unwrap()).unwrap();
    assert_eq!(payload[0]["comments"][0]["can_delete"], true);
    assert!(std::process::Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["config", "user.email", "bob@example.test"])
        .status()
        .unwrap()
        .success());
    // A stale permission from Alice cannot authorize deletion once local identity changes.
    assert!(delete(&db, "root").is_err());
    let payload = with_permissions(&db, "mr", db.list_discussions("mr").unwrap()).unwrap();
    assert_eq!(payload[0]["comments"][0]["can_delete"], false);
}

#[test]
fn unavailable_repository_keeps_content_readable_without_delete_permission() {
    use crate::features::virtual_mr::discussion_deletion::{delete, with_permissions};
    let db = fixture();
    let payload = with_permissions(&db, "mr", db.list_discussions("mr").unwrap()).unwrap();
    assert_eq!(payload[0]["comments"][0]["can_delete"], false);
    assert!(delete(&db, "root").is_err());
    assert_eq!(db.list_discussions("mr").unwrap()[0].comments.len(), 1);
}
