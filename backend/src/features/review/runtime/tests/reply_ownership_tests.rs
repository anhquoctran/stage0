use super::{
    discussion_fixture::{action, call, list, setup},
    *,
};
use crate::features::review::{
    persistence::ReviewDiscussionAction,
    runtime::{action_dispatch::dispatch_action, scope, tool_state::ReviewToolState},
};

fn staged_reply(db: &Database) -> ReviewDiscussionAction {
    let args = action(db);
    ReviewDiscussionAction::Reply {
        discussion_id: "thread".into(),
        target_comment_id: "user".into(),
        discussion_revision: args["discussionRevision"].as_str().unwrap().into(),
        body: "Unsolicited reply".into(),
    }
}

#[tokio::test]
async fn human_threads_reject_unsolicited_replies_at_every_backend_boundary() {
    for body in [
        "!1",
        "c419ba81fd4c7b10956388297e4b8728b0f910df",
        "[@!1](#mr-mention/mr/mr-1)",
        "[@c419ba8](#mr-mention/commit/c419ba81fd4c7b10956388297e4b8728b0f910df)",
        "> [@Bot](#mr-mention/reviewer/bot)",
        "`[@Bot](#mr-mention/reviewer/bot)`",
    ] {
        let (_repo, mut run, context, db) = setup("Human discussion");
        db.conn().execute_batch("UPDATE virtual_mr_discussions SET file_path=NULL; UPDATE virtual_mr_comments SET author_type='user',author_id='alice' WHERE id='root';").unwrap();
        db.conn()
            .execute(
                "UPDATE virtual_mr_comments SET body=?1 WHERE id='user'",
                [body],
            )
            .unwrap();
        let mut request = config("http://localhost".into());
        request.reviewer_id = Some("bot".into());
        request.reply_discussion_id = Some("thread".into());
        assert!(scope::validate_request(&db, &request).is_err(), "{body}");
        // Full-review runs must obey the same gate, even if a model asks anyway.
        let mut state = ReviewToolState::new(false);
        let page = list(&db, &run, &mut state, &context);
        assert_eq!(page["threads"][0]["canReply"], false, "{body}");
        assert!(
            dispatch_action(
                &db,
                &mut run,
                &context,
                &call("reply_to_discussion", action(&db)),
                &mut state
            )
            .await
            .unwrap()
            .is_err(),
            "{body}"
        );
        run.status = "completed".into();
        run.decision = Some("comment".into());
        assert!(
            db.publish_review_actions(&run, &[staged_reply(&db)])
                .is_err(),
            "{body}"
        );
        assert_eq!(db.list_discussions("session").unwrap()[0].comments.len(), 2);
    }
}

#[tokio::test]
async fn human_thread_mentions_address_only_the_requested_reviewer_and_do_not_transfer_ownership() {
    let (_repo, mut run, context, db) = setup("!1");
    db.conn().execute_batch("UPDATE virtual_mr_discussions SET file_path=NULL; UPDATE virtual_mr_comments SET author_type='user',author_id='alice' WHERE id='root'; INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','other','Other'); UPDATE virtual_mr_comments SET body='[@Bot](#mr-mention/reviewer/bot) explain' WHERE id='user';").unwrap();
    let mut request = config("http://localhost".into());
    request.reviewer_id = Some("other".into());
    request.reply_discussion_id = Some("thread".into());
    assert!(scope::validate_request(&db, &request).is_err());
    request.reviewer_id = Some("bot".into());
    assert!(scope::validate_request(&db, &request).is_ok());
    let mut state = ReviewToolState::new(false);
    assert_eq!(
        list(&db, &run, &mut state, &context)["threads"][0]["canReply"],
        true
    );
    dispatch_action(
        &db,
        &mut run,
        &context,
        &call("reply_to_discussion", action(&db)),
        &mut state,
    )
    .await
    .unwrap()
    .unwrap();
    run.status = "completed".into();
    run.decision = Some("comment".into());
    db.publish_review_actions(&run, &state.pending_discussion_actions)
        .unwrap();
    db.conn().execute_batch("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('next','thread','user','alice','Alice','A message for humans','now','now');").unwrap();
    assert!(scope::validate_request(&db, &request).is_err());
    assert_eq!(
        list(&db, &run, &mut ReviewToolState::new(false), &context)["threads"][0]["canReply"],
        false
    );
}

#[test]
fn finding_followups_stay_with_their_original_assigned_reviewer_including_legacy_runs() {
    let (_repo, run, _, db) = setup("Finding");
    db.conn().execute_batch("INSERT INTO virtual_mr_session_reviewers(session_id,agent_id,agent_name) VALUES('session','other','Other');").unwrap();
    let mut request = config("http://localhost".into());
    request.reply_discussion_id = Some("thread".into());
    request.reviewer_id = Some("bot".into());
    assert!(scope::validate_request(&db, &request).is_ok());
    request.reviewer_id = Some("other".into());
    assert!(scope::validate_request(&db, &request).is_err());
    db.conn()
        .execute(
            "UPDATE virtual_mr_comments SET author_id=?1 WHERE id='root'",
            [&run.id],
        )
        .unwrap();
    request.reviewer_id = Some("bot".into());
    assert!(scope::validate_request(&db, &request).is_ok());
    request.reviewer_id = Some("other".into());
    assert!(scope::validate_request(&db, &request).is_err());
    // A matching human ID or display name never replaces a direct mention.
    db.conn().execute_batch("UPDATE virtual_mr_comments SET author_type='user',author_id='bot',author_name='Bot' WHERE id='root'; UPDATE virtual_mr_comments SET body='Please explain without a mention' WHERE id='user';").unwrap();
    request.reviewer_id = Some("bot".into());
    assert!(scope::validate_request(&db, &request).is_err());
}

#[test]
fn publication_rechecks_ownership_after_an_assigned_reviewer_is_removed() {
    let (_repo, mut run, _, db) = setup("Finding");
    let action = staged_reply(&db);
    db.conn()
        .execute("DELETE FROM virtual_mr_session_reviewers", [])
        .unwrap();
    run.status = "completed".into();
    run.decision = Some("comment".into());
    assert!(db.publish_review_actions(&run, &[action]).is_err());
    assert_eq!(db.list_discussions("session").unwrap()[0].comments.len(), 2);
}
