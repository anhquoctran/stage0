use super::*;
use crate::features::review::{discussion_reply, discussion_scope, manual_command};

#[test]
fn root_command_parser_matches_the_frontend_fixture_and_rejects_ordinary_or_malformed_mentions() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../../../../test-data/manual-review-commands.json"
    ))
    .unwrap();
    for case in cases {
        let body = case["body"].as_str().unwrap();
        let expected: Vec<String> = serde_json::from_value(case["targets"].clone()).unwrap();
        assert_eq!(
            manual_command::targets(body).unwrap_or_default(),
            expected,
            "{body}"
        );
    }
}

#[test]
fn multi_bot_root_commands_require_each_assignment_and_each_bots_findings_to_be_resolved() {
    let repo = TestRepo::new();
    let (run, _) = repo.review();
    let db = test_database(&run);
    db.conn().execute_batch("INSERT INTO virtual_mr_discussions(id,session_id) VALUES('request','session'); INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('root','request','user','alice','Alice','[@One](#mr-mention/reviewer/one) [@Two](#mr-mention/reviewer/two) [@Three](#mr-mention/reviewer/three) review','now','now'); INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','one','One'),('session','two','Two'),('session','three','Three'),('session','other','Other');").unwrap();
    let mut cfg = config("http://localhost".into());
    cfg.manual_review_discussion_id = Some("request".into());
    for id in ["one", "two", "three"] {
        cfg.reviewer_id = Some(id.into());
        assert!(
            super::super::scope::validate_request(&db, &cfg).is_ok(),
            "{id}"
        );
    }
    cfg.reviewer_id = Some("other".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_err());
    db.conn()
        .execute(
            "DELETE FROM virtual_mr_session_reviewers WHERE agent_id='three'",
            [],
        )
        .unwrap();
    cfg.reviewer_id = Some("three".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_err());
    db.conn().execute_batch("INSERT INTO virtual_mr_discussions(id,session_id,file_path) VALUES('finding','session','source.rs'); INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('finding-root','finding','ai_agent','two','Stage0 AI (Two)','Fix this concern','now','now');").unwrap();
    cfg.reviewer_id = Some("two".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_err());
    cfg.reviewer_id = Some("one".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_ok());
    db.conn()
        .execute(
            "UPDATE virtual_mr_discussions SET is_resolved=1 WHERE id='finding'",
            [],
        )
        .unwrap();
    cfg.reviewer_id = Some("two".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_ok());
    let thread = db
        .list_discussions("session")
        .unwrap()
        .into_iter()
        .find(|d| d.id == "request")
        .unwrap();
    assert!(discussion_scope::is_control(&thread));
    assert!(!discussion_reply::can_reply(
        &db.conn(),
        "session",
        Some("two"),
        "request"
    ));
    // A reply command never becomes a new full review request.
    db.conn().execute_batch("UPDATE virtual_mr_comments SET body='Ordinary user discussion' WHERE id='root'; INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('reply','request','user','alice','Alice','[@One](#mr-mention/reviewer/one) [@Two](#mr-mention/reviewer/two) review','now','now');").unwrap();
    assert!(super::super::scope::validate_request(&db, &cfg).is_err());
    cfg.manual_review_discussion_id = None;
    cfg.reply_discussion_id = Some("request".into());
    assert!(super::super::scope::validate_request(&db, &cfg).is_err());
    db.conn().execute("UPDATE virtual_mr_comments SET body='[@Two](#mr-mention/reviewer/two) Please explain this fix' WHERE id='reply'",[]).unwrap();
    assert!(super::super::scope::validate_request(&db, &cfg).is_ok());
    let thread = db
        .list_discussions("session")
        .unwrap()
        .into_iter()
        .find(|d| d.id == "request")
        .unwrap();
    assert!(!discussion_scope::is_control(&thread));
}
