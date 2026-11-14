use super::{
    continuation_tests::{add_threads, PlanningModel},
    discussion_fixture::{call, setup},
    *,
};
use crate::features::review::runtime::{
    action_dispatch::dispatch_action, discussions, tool_state::ReviewToolState,
};

#[tokio::test]
async fn discussion_pagination_is_byte_bounded_contiguous_and_never_authorizes_truncated_or_rejected_context(
) {
    let (_repo, mut run, context, db) = setup("Original finding");
    add_threads(&db, 18, &"🧪".repeat(600));
    let mut state = ReviewToolState::new(false);
    let mut offset = 0;
    let mut ids = std::collections::HashSet::new();
    loop {
        let page = discussions::list(&db, &run, &mut state, &context, offset).unwrap();
        assert!(page.to_string().len() <= 16 * 1024);
        let threads = page["threads"].as_array().unwrap();
        assert!(threads.len() <= 8 && !threads.is_empty());
        for thread in threads {
            assert!(ids.insert(thread["id"].as_str().unwrap().to_owned()));
        }
        if let Some(next) = page["nextOffset"].as_u64() {
            assert_eq!(next as usize, offset + threads.len());
            offset = next as usize;
        } else {
            break;
        }
    }
    assert_eq!(ids.len(), 19);
    let obs = &state.observations["discussion-0"];
    assert!(obs.validate(&obs.revision, "discussion-0-latest").is_err());
    let args = json!({"discussionId":"discussion-0","discussionRevision":obs.revision,"targetCommentId":"discussion-0-latest","body":"Unobserved reply"});
    assert!(dispatch_action(
        &db,
        &mut run,
        &context,
        &call("reply_to_discussion", args),
        &mut state
    )
    .await
    .unwrap()
    .is_err());
    let mut rejected = ReviewToolState::new(false);
    context.lock().unwrap().max_bytes = 0;
    assert!(discussions::list(&db, &run, &mut rejected, &context, 0).is_err());
    assert!(rejected.observations.is_empty());
}

#[test]
fn larger_discussion_batches_keep_reply_only_scope_and_deny_unmentioned_thread_ownership() {
    let (_repo, run, context, db) = setup("Own original finding");
    add_threads(&db, 10, "This does not mention the assigned reviewer");
    let mut state = ReviewToolState::new(false);
    state.reply_discussion_id = Some("thread".into());
    let page = discussions::list(&db, &run, &mut state, &context, 0).unwrap();
    assert_eq!(page["threads"].as_array().unwrap().len(), 1);
    assert_eq!(page["threads"][0]["id"], "thread");
    assert!(page["nextOffset"].is_null());
    let page = discussions::list(&db, &run, &mut ReviewToolState::new(false), &context, 0).unwrap();
    for row in page["threads"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| r["id"] != "thread")
    {
        assert_eq!(row["canReply"], false);
    }
}

#[test]
fn discussion_batches_fit_the_remaining_context_instead_of_failing_on_a_larger_default_page() {
    let (_repo, run, context, db) = setup("Original finding");
    add_threads(&db, 10, "Short context; never claim additional permissions");
    context.lock().unwrap().max_bytes = 4096;
    let mut state = ReviewToolState::new(false);
    let page = discussions::list(&db, &run, &mut state, &context, 0).unwrap();
    assert!(page.to_string().len() <= 4096);
    assert!(!page["threads"].as_array().unwrap().is_empty());
    assert!(page["nextOffset"].as_u64().is_some());
    assert!(!context.lock().unwrap().limited);
}

#[tokio::test]
async fn six_discussions_fit_one_bounded_page_and_a_ten_file_review_finishes_inside_budget() {
    let repo = TestRepo::new();
    repo.git(&["rm", ".env"]);
    repo.write(
        "source.rs",
        &(0..18)
            .map(|n| format!("fn value_{n}() -> u32 {{ {n} }}\n"))
            .collect::<String>(),
    );
    for file in 0..8 {
        repo.write(
            &format!("file-{file}.rs"),
            &(0..18)
                .map(|n| format!("fn item_{file}_{n}() -> u32 {{ {} }}\n", file + n))
                .collect::<String>(),
        );
    }
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Ten-file review fixture"]);
    let (mut run, ctx) = repo.review();
    assert_eq!(run.snapshot.changed_files.len(), 10);
    assert!(run.snapshot.excluded_files.is_empty());
    let context = Arc::new(Mutex::new(ctx));
    let db = test_database(&run);
    db.save_review_run(&run).unwrap();
    add_threads(&db,6,"This existing discussion needs source verification; inspect the immutable snapshot and avoid repeating unsupported claims.");
    let model = PlanningModel::paging();
    let result = execute_with_adapter(
        &db,
        &config("http://localhost".into()),
        &mut run,
        &context,
        &model,
    )
    .await;
    assert!(result.is_ok(), "{result:?}");
    run.finish(result);
    assert_eq!(run.status, "completed");
    assert_eq!(run.decision.as_deref(), Some("comment"));
    assert!(run.usage_tokens < 64000);
    assert!(run.published);
    let requests = model.requests.lock().unwrap();
    assert_eq!(
        requests.len(),
        2,
        "Two-thread pagination used additional paid model continuations"
    );
    let result: Value = serde_json::from_str(
        requests[1]["messages"]
            .as_array()
            .unwrap()
            .iter()
            .find(|m| m["role"] == "tool")
            .unwrap()["content"]
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(result["result"]["threads"].as_array().unwrap().len(), 6);
    assert!(result["result"]["nextOffset"].is_null());
    assert_eq!(context.lock().unwrap().complete_diffs.len(), 10);
    assert_eq!(
        db.list_discussions("session")
            .unwrap()
            .iter()
            .filter(|d| d.is_resolved)
            .count(),
        0
    );
    eprintln!(
        "Synthetic ten-file/six-discussion review: {} requests, {} reported tokens",
        requests.len(),
        run.usage_tokens
    );
}
