use super::*;
use crate::features::review::test_repo::TestRepo;
use serde_json::json;

fn utf16(text: &str) -> Vec<u8> {
    let mut bytes = vec![0xff, 0xfe];
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }
    bytes
}

#[test]
fn decoded_snapshots_preserve_redaction_pagination_and_authoritative_source_lines() {
    let repo = TestRepo::new();
    repo.git(&["checkout", "main"]);
    std::fs::write(
        repo.path.join("encoded.rs"),
        utf16("// \u{65e5}\u{672c}\u{4e0a}\nfn value() { old(); }\n"),
    )
    .unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Encoded base"]);
    repo.git(&["checkout", "feature"]);
    repo.git(&["merge", "main", "--no-edit"]);
    std::fs::write(repo.path.join("encoded.rs"), utf16(
        "// \u{65e5}\u{672c}\u{4e0a}\nfn value() { new(); }\n-----BEGIN PRIVATE KEY-----\nfixture-only-material\n-----END PRIVATE KEY-----\n")).unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Encoded feature"]);
    let guards = Arc::new(GuardrailsEngine::new());
    let snapshot = capture(repo.path(), "main", "feature", &guards).unwrap();
    let mut context = ReviewContext::new(snapshot, guards);
    repo.write("encoded.rs", "UNCOMMITTED\n");
    let blob = context.blob("encoded.rs", "head").unwrap();
    assert!(blob.contains("\u{65e5}\u{672c}\u{4e0a}"));
    assert!(!blob.contains("fixture-only-material"));
    assert!(!blob.contains("UNCOMMITTED"));
    let range = context
        .execute(
            "read_file_range",
            &json!({"filePath":"encoded.rs", "side":"head", "startLine":1, "endLine":2}),
        )
        .unwrap();
    assert!(range["content"]
        .as_str()
        .unwrap()
        .contains("2: fn value() { new(); }"));
    let diff = context
        .execute(
            "get_file_diff",
            &json!({"filePath":"encoded.rs", "offset":0}),
        )
        .unwrap();
    let text = diff.to_string();
    assert!(text.contains("+fn value() { new(); }"));
    assert!(!text.contains("fixture-only-material"));
    assert!(!text.contains("UNCOMMITTED"));
    assert!(context.complete_diffs.contains("encoded.rs"));
    assert!(
        context.limited,
        "Decoded secrets must retain the original review limitation flag"
    );
}

#[test]
fn legacy_source_reads_and_ascii_grep_decode_the_complete_blob() {
    let repo = TestRepo::new();
    std::fs::write(
        repo.path.join("legacy.txt"),
        b"# coding: windows-1252\ncaf\xe9 marker\n",
    )
    .unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Legacy source"]);
    let guards = Arc::new(GuardrailsEngine::new());
    let mut context = ReviewContext::new(
        capture(repo.path(), "main", "feature", &guards).unwrap(),
        guards,
    );
    assert!(context
        .blob("legacy.txt", "head")
        .unwrap()
        .contains("caf\u{e9} marker"));
    let matches = context
        .execute("search_code", &json!({"query":"marker"}))
        .unwrap();
    assert!(matches.to_string().contains("caf\u{e9} marker"));
}

#[test]
fn a_false_utf16_bom_cannot_encode_raw_ascii_secrets_past_the_egress_filter() {
    let repo = TestRepo::new();
    let mut bytes = vec![0xff, 0xfe];
    bytes.extend_from_slice(
        b"-----BEGIN PRIVATE KEY-----\nfixture-private-material\n-----END PRIVATE KEY-----\n",
    );
    if bytes.len() % 2 != 0 {
        bytes.push(b' ');
    }
    // These bytes form valid but unrelated UTF-16 scalar values. Conversion
    // alone is insufficient to preserve the original secret policy.
    assert!(crate::common::text_encoding::decode_buffer(&bytes, None).is_ok());
    std::fs::write(repo.path.join("encoded.rs"), bytes).unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "False encoding fixture"]);
    let guards = Arc::new(GuardrailsEngine::new());
    let mut context = ReviewContext::new(
        capture(repo.path(), "main", "feature", &guards).unwrap(),
        guards,
    );
    assert!(context.blob("encoded.rs", "head").is_err());
    assert!(context
        .execute(
            "get_file_diff",
            &json!({"filePath":"encoded.rs", "offset":0})
        )
        .is_err());
    assert!(!context.complete_diffs.contains("encoded.rs"));
}

#[cfg(unix)]
#[test]
fn decoding_preserves_executable_bit_changes_when_unicode_content_is_identical() {
    let repo = TestRepo::new();
    repo.git(&["checkout", "main"]);
    std::fs::write(repo.path.join("encoded.rs"), utf16("fn value() {}\n")).unwrap();
    repo.git(&["add", "."]);
    repo.git(&["commit", "-m", "Encoded mode base"]);
    repo.git(&["checkout", "feature"]);
    repo.git(&["merge", "main", "--no-edit"]);
    repo.git(&["update-index", "--chmod=+x", "encoded.rs"]);
    repo.git(&["commit", "-m", "Encoded executable bit"]);
    let guards = Arc::new(GuardrailsEngine::new());
    let mut context = ReviewContext::new(
        capture(repo.path(), "main", "feature", &guards).unwrap(),
        guards,
    );
    let diff = context
        .execute(
            "get_file_diff",
            &json!({"filePath":"encoded.rs", "offset":0}),
        )
        .unwrap()
        .to_string();
    assert!(diff.contains("old mode 100644"));
    assert!(diff.contains("new mode 100755"));
}
