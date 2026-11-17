use super::{
    discussion_fixture::{list, setup},
    *,
};
use crate::features::review::{
    fixture_acp_adapter::FixtureAcpAdapter,
    runtime::{scope, tool_state::ReviewToolState},
};

#[test]
fn finding_authorship_never_replaces_a_direct_mention_in_the_latest_comment() {
    let (_repo, run, context, db) = setup("Finding from this bot");
    let mut request = config("http://localhost".into());
    request.reviewer_id = Some("bot".into());
    request.reply_discussion_id = Some("thread".into());
    for (body, allowed) in [
        ("Please explain this finding", false),
        ("Thanks for reviewing", false),
        ("[@Bot](#mr-mention/reviewer/bot)", false),
        ("[@Bot](#mr-mention/reviewer/bot) ???", false),
        ("> [@Bot](#mr-mention/reviewer/bot) explain", false),
        ("[@Other](#mr-mention/reviewer/other) explain", false),
        ("[@Bot](#mr-mention/reviewer/bot) why is this wrong?", true),
    ] {
        db.conn()
            .execute(
                "UPDATE virtual_mr_comments SET body=?1 WHERE id='user'",
                [body],
            )
            .unwrap();
        assert_eq!(
            scope::validate_request(&db, &request).is_ok(),
            allowed,
            "{body}"
        );
        let page = list(&db, &run, &mut ReviewToolState::new(false), &context);
        assert_eq!(page["threads"][0]["canReply"], allowed, "{body}");
    }
}

#[tokio::test]
async fn native_and_acp_may_finish_without_a_reply_after_reading_an_unhelpful_mention() {
    for acp in [false, true] {
        let (_repo, mut run, context, db) = setup("Original finding");
        db.conn().execute("UPDATE virtual_mr_comments SET body='[@Bot](#mr-mention/reviewer/bot) thanks, no question or action needed' WHERE id='user'", []).unwrap();
        let mut request = config("http://localhost".into());
        request.reviewer_id = Some("bot".into());
        request.reply_discussion_id = Some("thread".into());
        let steps = [
            ("list_open_discussions", json!({"offset":0})),
            (
                "submit_review",
                json!({"summary":"No reply needed: this is an acknowledgement with no question or useful information to add.","decision":"comment","findings":[]}),
            ),
        ];
        if acp {
            request.execution_mode = "acp".into();
            let adapter = FixtureAcpAdapter::new(steps.iter().map(|(name,args)| json!({"output":json!({"calls":[{"name":name,"arguments":args}]}).to_string()})).collect());
            super::super::engine::execute_with_adapter(&db, &request, &mut run, &context, &adapter)
                .await
                .unwrap();
            assert_eq!(adapter.requests.lock().unwrap().len(), 2);
        } else {
            let (url, requests) = server(
                steps
                    .iter()
                    .map(|(name, args)| reply(name, args.clone()))
                    .collect(),
            )
            .await;
            request.base_url = url;
            execute(&db, &request, &mut run, &context).await.unwrap();
            assert_eq!(requests.await.unwrap().len(), 2);
        }
        assert_eq!(run.status, "completed");
        assert!(!run.published);
        assert!(run.findings.is_empty());
        assert!(run.generated_description.is_none());
        assert_eq!(db.list_discussions("session").unwrap()[0].comments.len(), 2);
        let verdict: String = db
            .conn()
            .query_row(
                "SELECT review_status FROM virtual_mr_session_reviewers WHERE agent_id='bot'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(verdict, "approved");
    }
}

#[tokio::test]
async fn no_reply_completion_requires_complete_context_and_rejects_stale_observations() {
    use super::super::{action_dispatch::dispatch_action, reply_completion};
    use super::discussion_fixture::call;
    let (_repo, mut run, context, db) = setup(&"Long finding. ".repeat(80));
    let mut request = config("http://localhost".into());
    request.reviewer_id = Some("bot".into());
    request.reply_discussion_id = Some("thread".into());
    let mut state = ReviewToolState::new(false);
    scope::configure(&db, &request, &mut state).unwrap();
    assert!(reply_completion::validate(&db, &run, &state).is_err());
    let page = list(&db, &run, &mut state, &context);
    assert!(reply_completion::validate(&db, &run, &state).is_err());
    let read = call(
        "read_discussion_comment",
        json!({"discussionId":"thread","commentId":"root",
        "discussionRevision":page["threads"][0]["discussionRevision"],"offset":200}),
    );
    dispatch_action(&db, &mut run, &context, &read, &mut state)
        .await
        .unwrap()
        .unwrap();
    assert!(reply_completion::validate(&db, &run, &state).unwrap());
    db.conn().execute("UPDATE virtual_mr_comments SET body='Edited question without a mention' WHERE id='user'", []).unwrap();
    assert!(reply_completion::validate(&db, &run, &state).is_err());
    assert_eq!(db.list_discussions("session").unwrap()[0].comments.len(), 2);
}

#[tokio::test]
async fn full_review_cannot_stage_or_publish_an_unmentioned_own_finding_reply() {
    use super::super::action_dispatch::dispatch_action;
    use super::discussion_fixture::{action, call};
    use crate::features::review::persistence::ReviewDiscussionAction;
    let (_repo, mut run, context, db) = setup("Own finding");
    db.conn()
        .execute(
            "UPDATE virtual_mr_comments SET body='Explain this finding' WHERE id='user'",
            [],
        )
        .unwrap();
    let mut state = ReviewToolState::new(false);
    list(&db, &run, &mut state, &context);
    let args = action(&db);
    assert!(dispatch_action(
        &db,
        &mut run,
        &context,
        &call("reply_to_discussion", args.clone()),
        &mut state
    )
    .await
    .unwrap()
    .is_err());
    let action = ReviewDiscussionAction::Reply {
        discussion_id: "thread".into(),
        target_comment_id: "user".into(),
        discussion_revision: args["discussionRevision"].as_str().unwrap().into(),
        body: "Unsolicited answer".into(),
    };
    run.status = "completed".into();
    run.decision = Some("comment".into());
    assert!(db.publish_review_actions(&run, &[action]).is_err());
    assert_eq!(db.list_discussions("session").unwrap()[0].comments.len(), 2);
}

#[test]
fn deliberate_no_reply_checks_are_quiet_but_errors_still_notify() {
    use super::super::completion_notification::should_notify;
    let (_repo, mut run, _, _db) = setup("Finding");
    run.reply_discussion_id = Some("thread".into());
    run.status = "completed".into();
    run.published = false;
    assert!(!should_notify(&run));
    for status in ["failed", "incomplete", "partial"] {
        run.status = status.into();
        assert!(should_notify(&run));
    }
    run.status = "completed".into();
    run.published = true;
    assert!(should_notify(&run));
    run.reply_discussion_id = None;
    run.published = false;
    assert!(should_notify(&run));
}
