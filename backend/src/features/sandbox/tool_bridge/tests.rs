use super::*;
use std::io::Cursor;

#[test]
fn rejects_non_relative_tool_paths() {
    for path in [
        "../secret",
        "src/../../secret",
        "/etc/passwd",
        "C:\\secret",
        "src\\..\\secret",
        "src/file:stream",
    ] {
        assert!(normalize_tool_file_path(path).is_err(), "accepted {path:?}");
    }
    assert_eq!(
        normalize_tool_file_path("src\\main.rs").unwrap(),
        "src/main.rs"
    );
}

#[test]
fn exposes_terminal_tools_only_for_docker() {
    let mut policy = super::super::guardrails::GuardrailPolicy::balanced();
    for sandbox in [SandboxType::InMemory, SandboxType::LocalWorktree] {
        let tools = get_tool_schemas(&sandbox, &policy).to_string();
        assert!(!tools.contains("execute_terminal_cmd"));
    }
    assert!(!get_tool_schemas(&SandboxType::Docker, &policy)
        .to_string()
        .contains("execute_terminal_cmd"));
    policy.require_human_confirmation_for_writes = false;
    assert!(get_tool_schemas(&SandboxType::Docker, &policy)
        .to_string()
        .contains("execute_terminal_cmd"));
}

#[test]
fn reads_only_requested_lines_and_reports_unknown_total() {
    let mut reader = Cursor::new(b"one\ntwo\nthree\nfour".to_vec());
    let range = read_file_range(&mut reader, 2, 3, 1024).unwrap();
    assert_eq!(range.content, "two\nthree");
    assert_eq!(range.actual_end_line, 3);
    assert_eq!(range.total_lines, None);
    assert!(!range.output_truncated);
}

#[test]
fn caps_a_single_oversized_line_without_buffering_it_all() {
    let mut reader = Cursor::new(vec![b'x'; 1024 * 1024]);
    let range = read_file_range(&mut reader, 1, 1, 128).unwrap();
    assert!(range.output_truncated);
    assert!(range.content.len() <= 128);
    assert!(range.content.ends_with(TOOL_OUTPUT_TRUNCATION_NOTICE));
}
