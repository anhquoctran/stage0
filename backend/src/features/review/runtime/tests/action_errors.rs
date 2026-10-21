use super::*;
use crate::features::review::runtime::{
    action_dispatch::dispatch_action, tool_state::ReviewToolState,
};
use crate::features::review::ReviewToolCall;

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
