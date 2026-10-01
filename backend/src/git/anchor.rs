use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use crate::db::VirtualMrDiscussionDb;

/// Computes a normalized hash of a single line of code (trimming leading/trailing whitespace).
pub fn compute_line_hash(line: &str) -> String {
    let mut hasher = DefaultHasher::new();
    line.trim().hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Extracts the context fingerprint for a target line number (1-indexed).
/// Returns `(content_hash, context_before, context_after)`.
pub fn extract_line_fingerprint(
    file_content: &str,
    line_number: usize,
) -> (String, Option<String>, Option<String>) {
    let lines: Vec<&str> = file_content.lines().collect();
    if line_number == 0 || line_number > lines.len() {
        return (String::new(), None, None);
    }

    let target_idx = line_number - 1;
    let target_line = lines[target_idx];
    let content_hash = compute_line_hash(target_line);

    let start_before = target_idx.saturating_sub(3);
    let context_before = if target_idx > 0 {
        Some(lines[start_before..target_idx].join("\n"))
    } else {
        None
    };

    let start_after = (target_idx + 1).min(lines.len());
    let end_after = (target_idx + 4).min(lines.len());
    let context_after = if start_after < end_after {
        Some(lines[start_after..end_after].join("\n"))
    } else {
        None
    };

    (content_hash, context_before, context_after)
}

/// Scores how well surrounding lines match the recorded context_before and context_after.
fn score_context(
    new_lines: &[&str],
    candidate_idx: usize,
    ctx_before: Option<&str>,
    ctx_after: Option<&str>,
) -> usize {
    let mut score = 0;

    if let Some(before_str) = ctx_before {
        let before_lines: Vec<&str> = before_str.lines().collect();
        let avail_before = candidate_idx.saturating_sub(before_lines.len());
        let actual_before = &new_lines[avail_before..candidate_idx];
        for (expected, actual) in before_lines.iter().rev().zip(actual_before.iter().rev()) {
            if expected.trim() == actual.trim() {
                score += 3;
            }
        }
    }

    if let Some(after_str) = ctx_after {
        let after_lines: Vec<&str> = after_str.lines().collect();
        let start_after = (candidate_idx + 1).min(new_lines.len());
        let end_after = (start_after + after_lines.len()).min(new_lines.len());
        let actual_after = &new_lines[start_after..end_after];
        for (expected, actual) in after_lines.iter().zip(actual_after.iter()) {
            if expected.trim() == actual.trim() {
                score += 3;
            }
        }
    }

    score
}

/// Re-anchors discussions across file modifications to prevent line drift.
///
/// 1. Verifies if the original line position still matches the content hash.
/// 2. If moved, searches for candidate lines with matching content hashes and scores them
///    using the 3-line before/after context fingerprints.
/// 3. If the line was deleted or completely rewritten, updates `verification_status` to "outdated".
pub fn reanchor_discussions(
    _repo_path: &str,
    file_path: &str,
    discussions: &[VirtualMrDiscussionDb],
    new_file_content: &str,
) -> Vec<VirtualMrDiscussionDb> {
    let new_lines: Vec<&str> = new_file_content.lines().collect();

    discussions
        .iter()
        .map(|disc| {
            let mut updated = disc.clone();

            // Only attempt re-anchoring if discussion targets this file and specifies a line number
            if updated.file_path.as_deref() != Some(file_path) || updated.line_number.is_none() {
                return updated;
            }

            let orig_line = updated.line_number.unwrap();
            let stored_hash = match updated.content_hash.as_deref() {
                Some(h) if !h.trim().is_empty() => h.trim(),
                _ => return updated, // No fingerprint recorded, preserve current location
            };

            let orig_idx = (orig_line - 1).max(0) as usize;

            // 1. Fast path: check if original line still matches
            if orig_idx < new_lines.len() && compute_line_hash(new_lines[orig_idx]) == stored_hash {
                if updated.verification_status == "outdated" {
                    updated.verification_status = "none".to_string();
                }
                return updated;
            }

            // 2. Search for candidates with matching content hash across the new file
            let mut candidates: Vec<(usize, usize)> = Vec::new(); // (line_idx, context_score)
            for (idx, line) in new_lines.iter().enumerate() {
                if compute_line_hash(line) == stored_hash {
                    let ctx_score = score_context(
                        &new_lines,
                        idx,
                        updated.context_before.as_deref(),
                        updated.context_after.as_deref(),
                    );
                    // Add proximity bonus (lines closer to original receive a tie-breaker bonus)
                    let dist = (idx as isize - orig_idx as isize).abs() as usize;
                    let proximity_bonus = 20usize.saturating_sub(dist / 5);
                    candidates.push((idx, ctx_score + proximity_bonus));
                }
            }

            if let Some(&(best_idx, score)) = candidates.iter().max_by_key(|(_, s)| *s) {
                if candidates.len() == 1 || score > 0 {
                    updated.line_number = Some((best_idx + 1) as i64);
                    if updated.verification_status == "outdated" {
                        updated.verification_status = "none".to_string();
                    }
                    return updated;
                }
            }

            // 3. Fallback: line was removed or completely rewritten -> mark Outdated
            updated.verification_status = "outdated".to_string();
            updated
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_fingerprint_and_reanchor() {
        let initial_code = "fn main() {\n    let a = 1;\n    let b = 2;\n    println!(\"{}\", a + b);\n}\n";
        let (hash, before, after) = extract_line_fingerprint(initial_code, 3);
        assert!(!hash.is_empty());
        assert!(before.as_deref().unwrap().contains("let a = 1;"));
        assert!(after.as_deref().unwrap().contains("println!"));

        // File modified: a line is inserted at line 2, shifting "let b = 2;" from line 3 to line 4
        let modified_code = "fn main() {\n    // inserted comment\n    let a = 1;\n    let b = 2;\n    println!(\"{}\", a + b);\n}\n";

        let disc = VirtualMrDiscussionDb {
            id: "disc-1".to_string(),
            session_id: "s1".to_string(),
            file_path: Some("src/main.rs".to_string()),
            diff_side: Some("right".to_string()),
            line_number: Some(3),
            commit_id: None,
            content_hash: Some(hash),
            context_before: before,
            context_after: after,
            is_resolved: false,
            resolve_type: "manual".to_string(),
            resolved_by: None,
            resolved_at: None,
            verification_status: "none".to_string(),
            verified_by_bot: None,
            verified_at: None,
            created_at: "2026-10-01T00:00:00Z".to_string(),
            comments: vec![],
        };

        let reanchored = reanchor_discussions("", "src/main.rs", &[disc], modified_code);
        assert_eq!(reanchored[0].line_number, Some(4));
        assert_ne!(reanchored[0].verification_status, "outdated");
    }

    #[test]
    fn test_deleted_line_marked_outdated() {
        let code = "fn main() {\n    println!(\"hello\");\n}\n";
        let (hash, before, after) = extract_line_fingerprint(code, 2);

        let disc = VirtualMrDiscussionDb {
            id: "disc-2".to_string(),
            session_id: "s1".to_string(),
            file_path: Some("src/main.rs".to_string()),
            diff_side: Some("right".to_string()),
            line_number: Some(2),
            commit_id: None,
            content_hash: Some(hash),
            context_before: before,
            context_after: after,
            is_resolved: false,
            resolve_type: "manual".to_string(),
            resolved_by: None,
            resolved_at: None,
            verification_status: "none".to_string(),
            verified_by_bot: None,
            verified_at: None,
            created_at: "2026-10-01T00:00:00Z".to_string(),
            comments: vec![],
        };

        let modified_code = "fn main() {\n    // line deleted\n}\n";
        let reanchored = reanchor_discussions("", "src/main.rs", &[disc], modified_code);
        assert_eq!(reanchored[0].verification_status, "outdated");
    }
}
