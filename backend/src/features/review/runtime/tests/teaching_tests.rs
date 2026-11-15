use super::{
    discussion_fixture::{call, setup},
    *,
};
use crate::features::review::{
    feedback,
    fixture_acp_adapter::FixtureAcpAdapter,
    runtime::{feedback_actions, tool_state::ReviewToolState},
    ReviewToolCall,
};

fn conversation(db: &Database) {
    db.conn().execute_batch("UPDATE virtual_mr_discussions SET file_path=NULL,commit_id=NULL WHERE id='thread'; UPDATE virtual_mr_comments SET author_type='user',author_id='alice',body='[@Bot](#mr-mention/reviewer/bot) Can we agree on a repository naming convention?' WHERE id='root'; DELETE FROM virtual_mr_comments WHERE id='user'; INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('proposal','thread','ai_agent','bot','Bot','Use descriptive test names throughout this repository?','now','now'),('user','thread','user','alice','Alice','[@Bot](#mr-mention/reviewer/bot) Yes, remember descriptive test names for this repository.','now','now');").unwrap();
}
fn classify(db: &Database, operation: &str) -> ReviewToolCall {
    let thread = feedback::thread(db, "thread").unwrap().unwrap();
    let target = thread
        .comments
        .iter()
        .rev()
        .find(|c| c.author_type == "user")
        .unwrap()
        .id
        .clone();
    call(
        "classify_review_feedback",
        json!({"discussionId":"thread","targetCommentId":target,"discussionRevision":crate::features::review::discussion_revision::current(&db.conn(),"thread").unwrap(),"operation":operation,"reason":"Use descriptive test names throughout this repository, as confirmed by the human"}),
    )
}

#[tokio::test]
async fn native_and_acp_can_remember_and_acknowledge_human_confirmed_preferences_in_a_reply_run() {
    for acp in [false, true] {
        let (_repo, mut run, context, db) = setup("Unused inline finding");
        conversation(&db);
        let mut cfg = config("http://localhost".into());
        cfg.reviewer_id = Some("bot".into());
        cfg.reply_discussion_id = Some("thread".into());
        context.lock().unwrap().feedback_enabled = true;
        let mut response = classify(&db, "remember").arguments;
        response.as_object_mut().unwrap().remove("operation");
        response.as_object_mut().unwrap().remove("reason");
        response["body"] = json!("Saved the repository test naming preference.");
        let steps = [
            ("list_review_feedback", json!({"offset":0})),
            (
                "classify_review_feedback",
                classify(&db, "remember").arguments,
            ),
            ("list_open_discussions", json!({"offset":0})),
            ("reply_to_discussion", response),
            (
                "submit_review",
                json!({"decision":"comment","findings":[],"summary":"Remembered the preference explicitly confirmed by the human and acknowledged it."}),
            ),
        ];
        if acp {
            cfg.execution_mode = "acp".into();
            let adapter=FixtureAcpAdapter::new(steps.iter().map(|(n,a)|json!({"output":json!({"calls":[{"name":n,"arguments":a}]}).to_string()})).collect());
            super::super::engine::execute_with_adapter(&db, &cfg, &mut run, &context, &adapter)
                .await
                .unwrap();
            assert_eq!(adapter.requests.lock().unwrap().len(), steps.len());
        } else {
            let (url, requests) =
                server(steps.iter().map(|(n, a)| reply(n, a.clone())).collect()).await;
            cfg.base_url = url;
            execute(&db, &cfg, &mut run, &context).await.unwrap();
            assert_eq!(requests.await.unwrap().len(), steps.len());
        }
        assert!(run.published);
        assert!(run.findings.is_empty());
        assert_eq!(run.decision.as_deref(), Some("comment"));
        let notes = feedback::memories(&db, "repo").unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].file_path, "");
        let thread = db.list_discussions("session").unwrap().remove(0);
        assert_eq!(thread.comments.len(), 4);
        assert!(!thread.is_resolved);
        assert!(thread.comments.last().unwrap().body.contains("Saved"));
    }
}

#[test]
fn classification_requires_every_conversation_page_and_rejects_stale_or_incomplete_history() {
    let (_repo, run, context, db) = setup("Unused inline finding");
    conversation(&db);
    db.conn()
        .execute("DELETE FROM virtual_mr_comments WHERE id='user'", [])
        .unwrap();
    for n in 0..9 {
        db.conn().execute("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES(?1,'thread','ai_agent','bot','Bot',?2,'now','now')",rusqlite::params![format!("middle-{n}"),if n==4 {"Long clarification. ".repeat(100)} else {"A prior clarification".into()}]).unwrap();
    }
    db.conn().execute_batch("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('user','thread','user','alice','Alice','[@Bot](#mr-mention/reviewer/bot) Yes, remember descriptive test names for this repository.','now','now')").unwrap();
    let mut state = ReviewToolState::new(false);
    let first = feedback_actions::list(&db, &run, &mut state, &context, 0).unwrap();
    assert_eq!(first["nextOffset"], 1006);
    assert!(feedback_actions::classify(&db, &run, &state, &classify(&db, "remember")).is_err());
    let next = feedback_actions::list(&db, &run, &mut state, &context, 1006).unwrap();
    assert!(next["nextOffset"].is_null());
    assert!(
        feedback_actions::classify(&db, &run, &state, &classify(&db, "remember")).is_err(),
        "A truncated middle comment must not count as fully read"
    );
    let revision = next["threads"][0]["discussionRevision"].clone();
    let mut offset = 600;
    loop {
        let result=super::super::discussions::read_comment(&db,&run,&mut state,&context,&call("read_discussion_comment",json!({"discussionId":"thread","discussionRevision":revision,"commentId":"middle-4","offset":offset}))).unwrap();
        match result["nextBodyOffset"].as_u64() {
            Some(next) => offset = next as usize,
            None => break,
        }
    }
    feedback_actions::classify(&db, &run, &state, &classify(&db, "remember")).unwrap();
    assert_eq!(feedback::memories(&db, "repo").unwrap().len(), 1);
    db.conn().execute("UPDATE virtual_mr_comments SET body='The human meant another scope' WHERE id='proposal'",[]).unwrap();
    assert!(feedback::memories(&db, "repo").unwrap().is_empty());
    assert!(feedback_actions::classify(&db, &run, &state, &classify(&db, "remember")).is_err());
}

#[tokio::test]
async fn an_ambiguous_turn_can_ask_for_clarification_then_remember_the_humans_scoped_confirmation()
{
    let (repo, mut run, context, db) = setup("Unused inline finding");
    conversation(&db);
    db.conn().execute("UPDATE virtual_mr_comments SET body='[@Bot](#mr-mention/reviewer/bot) Which naming convention would you suggest?' WHERE id='user'",[]).unwrap();
    let mut cfg = config("http://localhost".into());
    cfg.reviewer_id = Some("bot".into());
    cfg.reply_discussion_id = Some("thread".into());
    cfg.execution_mode = "acp".into();
    context.lock().unwrap().feedback_enabled = true;
    let mut question = classify(&db, "ignore").arguments;
    question.as_object_mut().unwrap().remove("operation");
    question.as_object_mut().unwrap().remove("reason");
    question["body"] =
        json!("Use descriptive test names only under tests/unit, or everywhere in the repository?");
    let steps = [
        ("list_review_feedback", json!({"offset":0})),
        (
            "classify_review_feedback",
            classify(&db, "ignore").arguments,
        ),
        ("list_open_discussions", json!({"offset":0})),
        ("reply_to_discussion", question),
        (
            "submit_review",
            json!({"decision":"comment","findings":[],"summary":"Asked about scope; no preference was learned."}),
        ),
    ];
    let adapter = FixtureAcpAdapter::new(
        steps
            .iter()
            .map(|(n, a)| json!({"output":json!({"calls":[{"name":n,"arguments":a}]}).to_string()}))
            .collect(),
    );
    super::super::engine::execute_with_adapter(&db, &cfg, &mut run, &context, &adapter)
        .await
        .unwrap();
    assert!(run.published);
    assert!(feedback::memories(&db, "repo").unwrap().is_empty());
    // The host lifecycle persists completion before accepting the next reply.
    db.save_review_run(&run).unwrap();
    db.conn().execute_batch("INSERT INTO virtual_mr_comments(id,discussion_id,author_type,author_id,author_name,body,created_at,updated_at) VALUES('confirmation','thread','user','alice','Alice','[@Bot](#mr-mention/reviewer/bot) Only tests/unit. Yes, remember that convention.','now','now')").unwrap();
    let (mut next, mut ctx) = repo.review();
    next.reviewer_id = Some("bot".into());
    next.reply_discussion_id = Some("thread".into());
    ctx.feedback_enabled = true;
    db.save_review_run(&next).unwrap();
    let ctx = Arc::new(Mutex::new(ctx));
    let mut memory = classify(&db, "remember");
    memory.arguments["reason"] =
        json!("Use descriptive test names only under tests/unit, as confirmed by the human.");
    let steps = [
        ("list_review_feedback", json!({"offset":0})),
        ("classify_review_feedback", memory.arguments),
        ("list_open_discussions", json!({"offset":0})),
        (
            "submit_review",
            json!({"decision":"comment","findings":[],"summary":"Remembered only the explicitly confirmed tests/unit preference."}),
        ),
    ];
    let adapter = FixtureAcpAdapter::new(
        steps
            .iter()
            .map(|(n, a)| json!({"output":json!({"calls":[{"name":n,"arguments":a}]}).to_string()}))
            .collect(),
    );
    super::super::engine::execute_with_adapter(&db, &cfg, &mut next, &ctx, &adapter)
        .await
        .unwrap();
    let notes = feedback::memories(&db, "repo").unwrap();
    assert_eq!(notes.len(), 1);
    assert!(notes[0].reason.contains("only under tests/unit"));
    assert_eq!(notes[0].comment_id, "confirmation");
}
