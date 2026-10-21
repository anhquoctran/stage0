use crate::features::git::runner::get_active_git_path;
use crate::features::review::{security, ReviewSnapshot};
use crate::features::sandbox::guardrails::GuardrailsEngine;
use std::collections::BTreeSet;
use std::time::Duration;

pub fn git(repo: &str, args: &[&str], cap: usize) -> Result<String, String> {
    let mut literal = vec![
        "--no-pager",
        "--literal-pathspecs",
        "--no-replace-objects",
        "--no-optional-locks",
        "-c",
        "color.ui=false",
        "-c",
        "color.grep=false",
        "-c",
        "core.quotePath=false",
        "-c",
        "core.fsmonitor=false",
    ];
    literal.extend_from_slice(args);
    let mut command = std::process::Command::new(get_active_git_path());
    command
        .current_dir(repo)
        .args(literal)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        // No remote transport, even on older Git versions that do not know
        // GIT_NO_LAZY_FETCH. Missing partial-clone objects fail closed.
        .env("GIT_ALLOW_PROTOCOL", "");
    let result = crate::common::process::run_bounded_command(
        &mut command,
        cap,
        16 * 1024,
        Duration::from_secs(15),
    )
    .map_err(|_| "Review Git read failed or timed out")?;
    if result.output_truncated {
        return Err("Git object exceeds the review safety limit".into());
    }
    if !result.status.success()
        && !(args.first() == Some(&"grep") && result.status.code() == Some(1))
    {
        return Err("Could not read the requested Git snapshot object".into());
    }
    String::from_utf8(result.stdout)
        .map_err(|_| "Non-UTF-8 Git objects are not reviewable as text".into())
}

pub fn resolve_snapshot_ref(repo: &str, reference: &str) -> Result<String, String> {
    let reference = reference.trim();
    if reference.is_empty()
        || reference.starts_with('-')
        || reference
            .chars()
            .any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("Invalid review reference".into());
    }
    let mut candidates = vec![reference.to_string()];
    if !reference.starts_with("origin/") && !reference.starts_with("refs/") {
        candidates.push(format!("origin/{reference}"));
        candidates.push(format!("remotes/origin/{reference}"));
    }
    if let Some(stripped) = reference.strip_prefix("origin/") {
        candidates.push(stripped.to_string());
    }
    for reference in candidates {
        if let Ok(value) = git(
            repo,
            &[
                "rev-parse",
                "--verify",
                "--end-of-options",
                &format!("{reference}^{{commit}}"),
            ],
            256,
        ) {
            let oid = value.trim();
            if [40, 64].contains(&oid.len()) && oid.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Ok(oid.into());
            }
        }
    }
    Err("Review reference is missing or unavailable locally. Fetch required objects explicitly before reviewing.".into())
}

pub fn capture(
    repo: &str,
    base: &str,
    head: &str,
    guards: &GuardrailsEngine,
) -> Result<ReviewSnapshot, String> {
    let base_sha = resolve_snapshot_ref(repo, base)?;
    let head_sha = resolve_snapshot_ref(repo, head)?;
    let merge_base_sha = git(repo, &["merge-base", &base_sha, &head_sha], 256)?
        .trim()
        .to_string();
    if merge_base_sha.len() != head_sha.len()
        || !merge_base_sha.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("No unique merge base for this review".into());
    }
    let changed = git(
        repo,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-renames",
            "--name-only",
            "-z",
            &merge_base_sha,
            &head_sha,
            "--",
        ],
        2 * 1024 * 1024,
    )?;
    let tree = git(
        repo,
        &["ls-tree", "-rz", "--full-tree", &head_sha],
        8 * 1024 * 1024,
    )?;
    let mut tree_files = Vec::new();
    let mut excluded = BTreeSet::new();
    for record in tree.split('\0').filter(|r| !r.is_empty()) {
        if let Some((header, path)) = record.split_once('\t') {
            if (header.starts_with("100644 blob ") || header.starts_with("100755 blob "))
                && security::safe_path(path, guards).is_ok()
            {
                tree_files.push(path.to_string());
            } else {
                excluded.insert(path.to_string());
            }
        }
    }
    let mut changed_files = Vec::new();
    for path in changed.split('\0').filter(|p| !p.is_empty()) {
        if security::safe_path(path, guards).is_err() || excluded.contains(path) {
            excluded.insert(path.to_string());
        } else {
            changed_files.push(path.to_string());
        }
    }
    // Report exclusions only within the change set; unrelated private files are
    // still omitted from searches/listings, but do not reduce changed-file coverage.
    let excluded_files = changed
        .split('\0')
        .filter(|p| excluded.contains(*p))
        .map(str::to_string)
        .collect();
    Ok(ReviewSnapshot {
        repo_path: repo.into(),
        base_sha,
        head_sha,
        merge_base_sha,
        changed_files,
        tree_files,
        excluded_files,
    })
}
