use super::*;
use crate::features::review::runtime::{
    action_dispatch::dispatch_action, tool_state::ReviewToolState,
};
use crate::features::review::ReviewToolCall;

#[tokio::test]
async fn discussion_database_failures_remain_fatal_after_context_validation() {
    let (_repo, mut run, context, db) = super::discussion_fixture::setup("An original finding");
    let mut state = ReviewToolState::new(false);
    super::discussion_fixture::list(&db, &run, &mut state, &context);
    let reply = super::discussion_fixture::call(
        "reply_to_discussion",
        super::discussion_fixture::action(&db),
    );
    db.conn()
        .execute_batch("DROP TABLE virtual_mr_comments;")
        .unwrap();
    let result = dispatch_action(&db, &mut run, &context, &reply, &mut state).await;
    assert!(result.unwrap_err().contains("virtual_mr_comments"));
    assert!(state.pending_discussion_actions.is_empty());
}

#[tokio::test]
async fn action_rejection_is_recoverable_but_state_persistence_failure_aborts_the_run() {
    let repo = TestRepo::new();
    let (mut run, context) = repo.review();
    let db = test_database(&run);
    let context = Arc::new(Mutex::new(context));
    let mut state = ReviewToolState::new(true);
    let call = ReviewToolCall {
        id: "description".into(),
        native_id: None,
        name: "update_mr_description".into(),
        arguments: json!({"description": "## Summary\nReviewed the changed code."}),
    };

    let rejected = dispatch_action(&db, &mut run, &context, &call, &mut state)
        .await
        .expect("an incomplete inventory must be a recoverable tool rejection");
    assert!(rejected.unwrap_err().contains("Read every page"));
    assert!(!state.description_updated);

    let paths = run.snapshot.changed_files.clone();
    for path in paths {
        let mut offset = 0;
        loop {
            let result = context
                .lock()
                .unwrap()
                .execute(
                    "get_file_diff",
                    &json!({"filePath": path, "offset": offset}),
                )
                .unwrap();
            let Some(next) = result["nextOffset"].as_u64() else {
                break;
            };
            offset = next;
        }
    }
    db.conn()
        .execute_batch(
            "CREATE TRIGGER reject_review_state BEFORE INSERT ON ai_review_runs
         BEGIN SELECT RAISE(ABORT, 'fixture persistence failure'); END;",
        )
        .unwrap();

    let failed = dispatch_action(&db, &mut run, &context, &call, &mut state).await;
    assert!(failed.unwrap_err().contains("Could not save review state"));
}
