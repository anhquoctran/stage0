use super::*;
use crate::features::review::{
    local_context::LocalContextRuntime, test_repo::TestRepo, ReviewFinding,
};
use serde_json::json;

fn ctx(repo: &TestRepo) -> ReviewContext {
    let guards = Arc::new(GuardrailsEngine::new());
    ReviewContext::new(
        capture(repo.path(), "main", "feature", &guards).unwrap(),
        guards,
    )
}

#[test]
fn persisted_source_does_not_transfer_coverage_and_evidence_bypasses_cache() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    let mut first = ctx(&repo);
    first.enable_local_context(&runtime);
    first
        .execute(
            "read_file_range",
            &json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":2}),
        )
        .unwrap();
    let mut next = ctx(&repo);
    next.enable_local_context(&runtime);
    assert!(next.complete_diffs.is_empty());
    assert!(next.inspected.is_empty());
    let result = next
        .execute(
            "read_file_range",
            &json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":2}),
        )
        .unwrap();
    assert!(result["content"].as_str().unwrap().contains("value()"));
    assert!(!result.to_string().contains("fixture-only"));
    assert!(next.complete_diffs.is_empty());
    let key = next.local_cache.as_ref().unwrap().key(
        "blob",
        &json!([
            next.snapshot.merge_base_sha,
            next.snapshot.head_sha,
            "source.rs",
            "head"
        ]),
    );
    // A forged public checksum cannot authenticate cache source. Evidence
    // independently rereads Git even if the persistent cache is modified.
    let db = std::fs::read_dir(root.path().join("repositories"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path()
        .join("context.db");
    let conn = rusqlite::Connection::open(db).unwrap();
    let dishonest = serde_json::to_string("fn value() -> u32 { 999 }\n").unwrap();
    use sha2::{Digest, Sha256};
    let checksum = format!("{:x}", Sha256::digest(dishonest.as_bytes()));
    conn.execute(
        "UPDATE reads SET body=?1,checksum=?2 WHERE key=?3",
        rusqlite::params![dishonest, checksum, key],
    )
    .unwrap();
    drop(conn);
    assert!(!next
        .cached_blob("source.rs", "head")
        .unwrap()
        .contains("999"));
    let finding = ReviewFinding {
        file_path: "source.rs".into(),
        side: "head".into(),
        start_line: 1,
        end_line: 1,
        severity: "high".into(),
        title: "Fabricated".into(),
        body: "Must reject".into(),
        evidence: "999".into(),
    };
    assert!(next.validate_findings(&[finding]).is_err());
    assert!(next
        .execute(
            "read_file_range",
            &json!({"filePath":".env","side":"head","startLine":1,"endLine":1})
        )
        .is_err());
}

#[test]
fn only_successfully_delivered_large_context_can_be_referenced() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    let mut ctx = ctx(&repo);
    ctx.enable_local_context(&runtime);
    let value = json!({"content":"source ".repeat(400)});
    let first = ctx.deduplicate_delivery(value.clone(), "fixture", &json!({}));
    assert!(first["contextReference"].is_string());
    // Merely preparing/rejecting an output never records a delivery.
    assert_ne!(
        ctx.deduplicate_delivery(value.clone(), "fixture", &json!({}))["alreadyDelivered"],
        true
    );
    ctx.remember_delivery(&first);
    assert_ne!(
        ctx.deduplicate_delivery(value.clone(), "fixture", &json!({"filePath":"another.rs"}))
            ["alreadyDelivered"],
        true
    );
    let next = ctx.deduplicate_delivery(value.clone(), "fixture", &json!({}));
    assert_eq!(next["alreadyDelivered"], true);
    assert!(next.to_string().len() < first.to_string().len());
    assert!(ctx.complete_diffs.is_empty());
    let mut fresh = super::local_context_tests::ctx(&repo);
    fresh.enable_local_context(&runtime);
    assert_ne!(
        fresh.deduplicate_delivery(value, "fixture", &json!({}))["alreadyDelivered"],
        true
    );
}

#[test]
fn disk_failure_and_missing_embedding_model_preserve_normal_source_reads() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    let mut ctx = ctx(&repo);
    ctx.enable_local_context(&runtime);
    assert!(!ctx.related_context_available());
    runtime.clear().unwrap();
    assert!(ctx
        .execute("get_file_diff", &json!({"filePath":"source.rs","offset":0}))
        .is_ok());
    let related = ctx
        .execute(
            "search_related_context",
            &json!({"query":"value implementation"}),
        )
        .unwrap();
    assert_eq!(related["indexComplete"], false);
    assert_eq!(related["matches"], json!([]));
}

#[test]
fn rejected_output_is_not_deduplicated_on_a_later_successful_read() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    repo.write(
        "source.rs",
        &(0..80)
            .map(|i| format!("fn item_{i}() -> usize {{ {i} }}\n"))
            .collect::<String>(),
    );
    repo.git(&["add", "source.rs"]);
    repo.git(&["commit", "-m", "Large read fixture"]);
    let mut ctx = ctx(&repo);
    ctx.enable_local_context(&runtime);
    ctx.max_bytes = 0;
    let args = json!({"filePath":"source.rs","side":"head","startLine":1,"endLine":80});
    assert!(ctx.execute("read_file_range", &args).is_err());
    assert!(ctx.delivered_context.is_empty());
    ctx.max_bytes = 128 * 1024;
    let output = ctx.execute("read_file_range", &args).unwrap();
    assert_ne!(output["alreadyDelivered"], true);
    assert!(output["content"].as_str().unwrap().contains("item_79"));
    assert!(ctx.limited);
}

#[test]
fn concurrent_exact_misses_share_only_the_source_read_not_run_coverage() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    let mut contexts = vec![ctx(&repo), ctx(&repo)];
    for ctx in &mut contexts {
        ctx.enable_local_context(&runtime);
    }
    let barrier = Arc::new(std::sync::Barrier::new(2));
    let threads = contexts
        .into_iter()
        .map(|ctx| {
            let barrier = Arc::clone(&barrier);
            std::thread::spawn(move || {
                barrier.wait();
                let text = ctx.cached_blob("source.rs", "head").unwrap();
                assert!(ctx.inspected.is_empty());
                assert!(ctx.complete_diffs.is_empty());
                (
                    text,
                    ctx.local_context_metrics().unwrap()["cacheHits"]
                        .as_u64()
                        .unwrap(),
                )
            })
        })
        .collect::<Vec<_>>();
    let outputs = threads
        .into_iter()
        .map(|t| t.join().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(outputs[0].0, outputs[1].0);
    assert_eq!(outputs.iter().map(|o| o.1).sum::<u64>(), 1);
}

#[test]
fn uncertified_agent_history_retention_keeps_complete_tool_outputs() {
    let root = tempfile::tempdir().unwrap();
    let runtime = LocalContextRuntime::new(root.path().into());
    let repo = TestRepo::new();
    let mut ctx = ctx(&repo);
    ctx.enable_local_context(&runtime);
    ctx.set_context_references(false);
    let value = json!({"content":"essential source ".repeat(300)});
    for _ in 0..2 {
        let output = ctx.deduplicate_delivery(value.clone(), "fixture", &json!({}));
        assert_eq!(output, value);
        ctx.remember_delivery(&output);
    }
    assert!(ctx.delivered_context.is_empty());
}
