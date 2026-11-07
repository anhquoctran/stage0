use super::*;
use crate::common::text_encoding::TextEncoding;

fn git(dir: &tempfile::TempDir, args: &[&str]) -> String {
    runner::run_git_strict(dir.path().to_str().unwrap(), args).unwrap()
}

fn repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(&dir, &["init", "-q", "-b", "main"]);
    for config in [
        ["user.name", "Encoding Fixture"],
        ["user.email", "fixture@example.test"],
        ["commit.gpgsign", "false"],
        ["core.hooksPath", ""],
    ] {
        git(&dir, &["config", config[0], config[1]]);
    }
    dir
}

fn utf16(text: &str, be: bool) -> Vec<u8> {
    let mut bytes = if be {
        vec![0xfe, 0xff]
    } else {
        vec![0xff, 0xfe]
    };
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&if be {
            unit.to_be_bytes()
        } else {
            unit.to_le_bytes()
        });
    }
    bytes
}

#[test]
fn branch_and_commit_diffs_decode_mixed_encodings_without_modifying_files_or_refs() {
    let dir = repo();
    let corpus: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../../test-data/text-encodings/corpus.json"
    ))
    .unwrap();
    let mut sources = Vec::new();
    for (index, fixture) in corpus.iter().enumerate() {
        let label = fixture["encoding"].as_str().unwrap();
        let hex = fixture["hex"].as_str().unwrap();
        let mut bytes: Vec<u8> = hex
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
            .collect();
        let encoding = TextEncoding::for_label(label).unwrap();
        match encoding {
            TextEncoding::Utf16Le => {
                bytes.splice(..0, [0xff, 0xfe]);
            }
            TextEncoding::Utf16Be => {
                bytes.splice(..0, [0xfe, 0xff]);
            }
            TextEncoding::Utf8 | TextEncoding::Utf8Bom => {}
            _ => {
                bytes.splice(
                    ..0,
                    format!("# coding: {}\n", label.replace(' ', "_")).bytes(),
                );
            }
        }
        let name = format!("file-{index:02}.txt");
        std::fs::write(dir.path().join(&name), &bytes).unwrap();
        sources.push((name, encoding, bytes));
    }
    std::fs::write(dir.path().join("binary.dat"), [0, 1, 2, 0xff]).unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "All source encodings"]);
    git(&dir, &["checkout", "-qb", "feature"]);
    for (name, encoding, original) in &sources {
        let mut bytes = original.clone();
        let tail = "new source line\n";
        if matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be) {
            for unit in tail.encode_utf16() {
                bytes.extend_from_slice(&if *encoding == TextEncoding::Utf16Le {
                    unit.to_le_bytes()
                } else {
                    unit.to_be_bytes()
                });
            }
        } else {
            bytes.extend_from_slice(tail.as_bytes());
        }
        std::fs::write(dir.path().join(name), bytes).unwrap();
    }
    std::fs::write(dir.path().join("binary.dat"), [0, 2, 3, 0xff]).unwrap();
    git(&dir, &["commit", "-qam", "Encoded source updates"]);
    let sha = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    std::fs::write(dir.path().join("file-00.txt"), "UNCOMMITTED").unwrap();
    let status = git(&dir, &["status", "--porcelain"]);
    let branch = diff::get_mr_diff(dir.path().to_str().unwrap(), "main", "feature").unwrap();
    let commit = commit_details::get_commit_details(dir.path().to_str().unwrap(), &sha).unwrap();
    for (files, patch) in [
        (&branch.files, &branch.raw_diff),
        (&commit.files, &commit.raw_diff),
    ] {
        assert_eq!(files.len(), 41);
        for (index, fixture) in corpus.iter().enumerate() {
            let name = format!("file-{index:02}.txt");
            assert!(
                !files
                    .iter()
                    .find(|file| file.path == name)
                    .unwrap()
                    .is_binary,
                "{}",
                fixture["encoding"]
            );
            let section = patch
                .split("\ndiff --git ")
                .find(|section| {
                    section
                        .lines()
                        .next()
                        .unwrap_or_default()
                        .contains(&format!("b/{name}"))
                })
                .unwrap();
            for line in fixture["text"].as_str().unwrap().lines() {
                assert!(
                    section.contains(line),
                    "Missing Unicode source for {}: {line}",
                    fixture["encoding"]
                );
            }
        }
        assert_eq!(patch.matches("+new source line").count(), 40);
        assert!(!patch.contains('\u{fffd}'));
        assert!(!patch.contains("UNCOMMITTED"));
        assert!(
            files
                .iter()
                .find(|file| file.path == "binary.dat")
                .unwrap()
                .is_binary
        );
    }
    assert_eq!(git(&dir, &["status", "--porcelain"]), status);
    assert_eq!(git(&dir, &["rev-parse", "HEAD"]).trim(), sha);
}

#[test]
fn utf16_blame_keeps_decoded_line_coordinates_despite_low_byte_newlines() {
    for be in [false, true] {
        let dir = repo();
        std::fs::write(
            dir.path().join("source.txt"),
            utf16("one\u{4e0a}\nsecond\u{1f600}\n", be),
        )
        .unwrap();
        git(&dir, &["add", "."]);
        git(&dir, &["commit", "-qm", "Encoded initial lines"]);
        let payload = blame::get_file_blame(
            dir.path().to_str().unwrap(),
            "source.txt",
            Some("HEAD"),
            None,
        )
        .unwrap();
        assert_eq!(
            payload
                .lines
                .iter()
                .map(|line| line.content.as_str())
                .collect::<Vec<_>>(),
            ["one\u{4e0a}", "second\u{1f600}"]
        );
        assert_eq!(
            payload
                .lines
                .iter()
                .map(|line| line.line_no)
                .collect::<Vec<_>>(),
            [1, 2]
        );
        assert_eq!(
            payload
                .lines
                .iter()
                .map(|line| line.orig_line_no)
                .collect::<Vec<_>>(),
            [1, 2]
        );
        assert_eq!(payload.author_stats[0].line_count, 2);
    }
}

#[test]
fn encoded_conflict_preview_merges_decoded_snapshots_without_rewriting_source() {
    let dir = repo();
    let file = dir.path().join("source.txt");
    std::fs::write(&file, utf16("base caf\u{e9}\n", false)).unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Base"]);
    git(&dir, &["checkout", "-qb", "feature"]);
    std::fs::write(&file, utf16("new caf\u{e9}\n", false)).unwrap();
    git(&dir, &["commit", "-qam", "Feature"]);
    git(&dir, &["checkout", "main"]);
    std::fs::write(&file, utf16("old caf\u{e9}\n", false)).unwrap();
    git(&dir, &["commit", "-qam", "Main"]);
    let before = std::fs::read(&file).unwrap();
    let preview = conflict::get_conflicted_file_preview(
        dir.path().to_str().unwrap(),
        "main",
        "feature",
        "source.txt",
    )
    .unwrap();
    assert_eq!(preview.base_content.as_deref(), Some("old caf\u{e9}\n"));
    assert_eq!(preview.compare_content.as_deref(), Some("new caf\u{e9}\n"));
    assert!(preview.has_conflict_markers);
    assert_eq!(preview.conflict_regions[0].base_code, "old caf\u{e9}");
    assert_eq!(preview.conflict_regions[0].compare_code, "new caf\u{e9}");
    assert_eq!(std::fs::read(file).unwrap(), before);
    assert!(git(&dir, &["status", "--porcelain"]).is_empty());
}

#[cfg(unix)]
#[test]
fn encoded_unicode_and_c_quoted_paths_round_trip_through_diff_and_blame() {
    let dir = repo();
    let names = [
        "unicode \u{65e5}\u{672c} name.txt",
        "tab\tline\nbell\u{7}.txt",
    ];
    for name in names {
        std::fs::write(dir.path().join(name), utf16("old\n", false)).unwrap();
    }
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Encoded filenames"]);
    git(&dir, &["checkout", "-qb", "feature"]);
    for name in names {
        std::fs::write(dir.path().join(name), utf16("new\n", false)).unwrap();
    }
    git(&dir, &["commit", "-qam", "Encoded filename changes"]);
    let diff = diff::get_mr_diff(dir.path().to_str().unwrap(), "main", "feature").unwrap();
    assert_eq!(diff.raw_diff.matches("+new").count(), 2);
    assert!(diff.files.iter().all(|file| !file.is_binary));
    for name in names {
        let payload =
            blame::get_file_blame(dir.path().to_str().unwrap(), name, Some("HEAD"), None).unwrap();
        assert_eq!(payload.lines[0].content, "new");
    }
}

#[test]
fn encoded_patch_limits_are_reported_instead_of_claiming_a_complete_preview() {
    let dir = repo();
    std::fs::write(
        dir.path().join("large.txt"),
        utf16(&format!("{}\n", "x".repeat(3_000_000)), false),
    )
    .unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "Large encoded base"]);
    std::fs::write(
        dir.path().join("large.txt"),
        utf16(&format!("{}\n", "y".repeat(3_000_000)), false),
    )
    .unwrap();
    git(&dir, &["commit", "-qam", "Large encoded change"]);
    let sha = git(&dir, &["rev-parse", "HEAD"]).trim().to_owned();
    let details = commit_details::get_commit_details(dir.path().to_str().unwrap(), &sha).unwrap();
    assert!(details.truncated);
    assert!(details.raw_diff.len() <= 5 * 1024 * 1024);
    assert!(details.raw_diff.contains("preview safety limit"));
}
