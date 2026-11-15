use super::*;
use crate::features::review::local_context::LocalContextRuntime;

#[tokio::test]
async fn native_tool_loop_reuses_delivered_context_without_reusing_a_verdict() {
    let repo = TestRepo::new();
    repo.write(
        "source.rs",
        &(0..90)
            .map(|i| format!("fn value_{i}() -> u32 {{ {i} }}\n"))
            .collect::<String>(),
    );
    repo.git(&["add", "source.rs"]);
    repo.git(&["commit", "-m", "Review context fixture"]);
    let cache_root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(cache_root.path().into());
    let mut measurements = Vec::new();
    for optimized in [false, true] {
        let (mut run, mut ctx) = repo.review();
        let db = test_database(&run);
        db.save_review_run(&run).unwrap();
        if optimized {
            ctx.enable_local_context(&runtime);
        }
        let (url,requests)=server(vec![
            reply("read_file_range",json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":90})),
            reply("read_file_range",json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":90})),
            reply("submit_review",json!({"summary":"Reviewed available immutable source","decision":"comment","findings":[]})),
        ]).await;
        let result = execute(&db, &config(url), &mut run, &Arc::new(Mutex::new(ctx))).await;
        assert!(result.is_ok(), "{result:?}");
        run.finish(result);
        assert_eq!(run.status, "partial"); // excluded source remains authoritative
        assert_eq!(run.decision.as_deref(), Some("comment"));
        assert_eq!(run.tool_calls, 3);
        let requests = requests.await.unwrap();
        assert_eq!(requests.len(), 3); // no model result or publication is replayed
        let history = requests[2]["messages"].as_array().unwrap();
        let last_tool = history.iter().rev().find(|m| m["role"] == "tool").unwrap();
        let result: Value = serde_json::from_str(last_tool["content"].as_str().unwrap()).unwrap();
        assert_eq!(result["result"]["alreadyDelivered"] == true, optimized);
        measurements.push(requests.iter().map(|r| r.to_string().len()).sum::<usize>());
    }
    assert!(measurements[1] < measurements[0], "{measurements:?}");
    eprintln!(
        "Controlled 3-turn request bytes: baseline={}, local-context={}",
        measurements[0], measurements[1]
    );
}
