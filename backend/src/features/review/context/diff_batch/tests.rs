use super::*;
use crate::features::review::test_repo::TestRepo;
use crate::features::sandbox::guardrails::GuardrailsEngine;
use std::{collections::HashMap, sync::Arc};

#[test]
fn small_snapshot_is_grouped_and_redacted_without_granting_undelivered_coverage() {
    let repo = TestRepo::new();
    let (_, mut context) = repo.review();
    repo.git(&["checkout", "main"]);
    repo.write("source.rs", "unrelated working tree\n");
    let batch = context.prepare_diff_batch(0, 0, 64 * 1024, true).unwrap();
    assert!(context.complete_diffs.is_empty());
    assert!(context.inspected.is_empty());
    assert_eq!(context.bytes, 0);
    assert!(batch.value["next"].is_null());
    assert_eq!(batch.value["coverageCompleteAfterDelivery"], true);
    assert_eq!(
        batch.value["manifest"]["paths"].as_array().unwrap().len(),
        2
    );
    assert_eq!(batch.value["files"].as_array().unwrap().len(), 2);
    let packet = batch.value.to_string();
    assert!(packet.contains("fn deleted()"));
    assert!(packet.contains("fn value() -> u32 { 2 }"));
    assert!(packet.contains("+[REDACTED"));
    assert!(
        !packet.contains("fixture-only")
            && !packet.contains("VERY_PRIVATE")
            && !packet.contains("unrelated working tree")
    );
    context.authorize_diff_batch(&batch, 64 * 1024).unwrap();
    assert!(context.complete_diffs.is_empty());
    context.commit_diff_batch(batch);
    assert_eq!(context.complete_diffs.len(), 2);
    assert!(context.limited);
}

#[test]
fn bounded_batches_reassemble_every_diff_without_skips_or_oversized_outputs() {
    let repo = TestRepo::new();
    repo.write(
        "large.rs",
        &(0..300)
            .map(|n| format!("let item_{n} = {n};\n"))
            .collect::<String>(),
    );
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Batch fixture"]);
    let (_, mut context) = repo.review();
    let mut cursor = (0, 0);
    let mut collected: HashMap<String, Vec<String>> = HashMap::new();
    let mut packets = 0;
    loop {
        let batch = context
            .prepare_diff_batch(cursor.0, cursor.1, 2048, false)
            .unwrap();
        assert!(batch.value.to_string().len() <= 2048);
        for file in batch.value["files"].as_array().unwrap() {
            let path = file["filePath"].as_str().unwrap().to_owned();
            assert!(file["error"].is_null());
            collected
                .entry(path)
                .or_default()
                .push(file["diff"].as_str().unwrap().to_owned());
            if file["diffLineOffset"].as_u64().unwrap() > 10 {
                assert!(file["startCoordinates"]["head"].as_u64().unwrap() > 0);
            }
        }
        let next = batch.value["next"].clone();
        context.authorize_diff_batch(&batch, 2048).unwrap();
        context.commit_diff_batch(batch);
        packets += 1;
        if next.is_null() {
            break;
        }
        let advanced = (
            next["fileOffset"].as_u64().unwrap() as usize,
            next["diffOffset"].as_u64().unwrap() as usize,
        );
        assert!(advanced > cursor);
        cursor = advanced;
        assert!(packets < 30);
    }
    assert!(packets > 1);
    assert_eq!(
        context.complete_diffs.len(),
        context.snapshot.changed_files.len()
    );
    for (path, pieces) in collected {
        let diff = context.snapshot_diff(&path).unwrap();
        assert_eq!(pieces.join("\n"), diff.batch_text(0, diff.lines.len()));
    }
}

#[test]
fn skipped_prefix_and_rejected_delivery_never_create_complete_coverage() {
    let repo = TestRepo::new();
    let (_, mut context) = repo.review();
    let batch = context.prepare_diff_batch(0, 2, 24 * 1024, false).unwrap();
    assert_eq!(batch.value["coverageCompleteAfterDelivery"], false);
    context.authorize_diff_batch(&batch, 24 * 1024).unwrap();
    context.commit_diff_batch(batch);
    assert!(!context.complete_diffs.contains("deleted.rs"));
    let (_, mut denied) = repo.review();
    let batch = denied.prepare_diff_batch(0, 0, 24 * 1024, false).unwrap();
    denied.max_bytes = 1;
    assert!(denied.authorize_diff_batch(&batch, 24 * 1024).is_err());
    assert!(denied.complete_diffs.is_empty() && denied.inspected.is_empty());
    assert_eq!(denied.bytes, 0);
    assert!(denied.diff_offsets.is_empty());
}

#[test]
fn grouped_reads_obey_policy_and_keep_unreadable_files_explicit_and_uncovered() {
    let repo = TestRepo::new();
    let guards = Arc::new(GuardrailsEngine::new());
    let mut policy = guards.get_policy();
    policy.max_file_read_lines = 2;
    policy.max_output_bytes = 1024;
    guards.update_policy(policy);
    let snapshot = super::super::capture(repo.path(), "main", "feature", &guards).unwrap();
    let mut context = ReviewContext::new(snapshot, Arc::clone(&guards));
    let result = context
        .execute("get_diff_batch", &json!({"fileOffset":0,"diffOffset":0}))
        .unwrap();
    assert!(result.to_string().len() <= 1024);
    assert!(
        result["files"]
            .as_array()
            .unwrap()
            .iter()
            .map(|file| file["diff"].as_str().unwrap().lines().count())
            .sum::<usize>()
            <= 2
    );
    assert!(!result["next"].is_null());
    context.snapshot_diff("source.rs").unwrap();
    let mut policy = guards.get_policy();
    policy.max_file_read_lines = 100;
    policy.max_output_bytes = 64 * 1024;
    policy.sensitive_path_patterns.push("source.rs".into());
    guards.update_policy(policy);
    let batch = context.prepare_diff_batch(0, 0, 24 * 1024, false).unwrap();
    let source = batch.value["files"]
        .as_array()
        .unwrap()
        .iter()
        .find(|file| file["filePath"] == "source.rs")
        .unwrap();
    assert!(source["error"].is_string());
    assert!(source["diff"].is_null());
    assert_eq!(batch.value["coverageCompleteAfterDelivery"], false);
    context.authorize_diff_batch(&batch, 24 * 1024).unwrap();
    context.commit_diff_batch(batch);
    assert!(!context.complete_diffs.contains("source.rs"));
    assert!(context.limited);
    assert!(context
        .execute(
            "get_diff_batch",
            &json!({"fileOffset":0,"diffOffset":0,"filePath":".env"})
        )
        .is_err());
}
