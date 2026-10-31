//! Read-only details and first-parent changes for one immutable commit.
use super::diff::{parse_name_status_z, parse_numstat_z};
use super::runner::{resolve_ref, run_git_with_limits};
use super::{ChangedFile, CommitDetail};
use std::time::Duration;

const MAX_PATCH_BYTES: usize = 5 * 1024 * 1024;
const MAX_METADATA_BYTES: usize = 1024 * 1024;

fn read_git(
    repo: &str,
    args: &[&str],
    limit: usize,
    allow_truncation: bool,
) -> Result<(String, bool), String> {
    let result = run_git_with_limits(
        repo,
        args,
        limit,
        MAX_METADATA_BYTES,
        Duration::from_secs(120),
    )?;
    if result.output_truncated && !allow_truncation {
        return Err(crate::common::messages::code("backend.git.commitMetadataLimitExceeded"));
    }
    if !result.success && !result.output_truncated {
        return Err(crate::common::messages::failure(
            "backend.git.commitDetailsLoadFailed",
            serde_json::json!({}),
            format!(
                "Could not load commit details: {}",
                super::runner::redact_sensitive_text(&result.stderr)
            ),
        ));
    }
    Ok((result.stdout, result.output_truncated))
}

pub fn get_commit_details(repo: &str, hash: &str) -> Result<CommitDetail, String> {
    if !matches!(hash.len(), 40 | 64) || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(crate::common::messages::code("backend.git.invalidCommitHash"));
    }
    let (hash, _) = resolve_ref(repo, hash)?;
    let (metadata, _) = read_git(
        repo,
        &[
            "show",
            "-s",
            "--no-show-signature",
            "--format=%H%x00%P%x00%an%x00%ae%x00%aI%x00%B",
            &hash,
            "--",
        ],
        MAX_METADATA_BYTES,
        false,
    )?;
    let fields: Vec<_> = metadata.splitn(6, '\0').collect();
    if fields.len() != 6 {
        return Err(crate::common::messages::code("backend.git.malformedCommitDetails"));
    }
    let parents: Vec<String> = fields[1].split_whitespace().map(str::to_owned).collect();
    let diff_args = |mode| {
        let mut args = if parents.is_empty() {
            vec!["diff-tree", "--root", "--no-commit-id", "-r"]
        } else {
            vec!["diff"]
        };
        args.extend(["--no-ext-diff", "--no-textconv", "--find-renames", mode]);
        if mode != "-p" {
            args.push("-z");
        } else {
            args.push("-U3");
        }
        if let Some(parent) = parents.first() {
            args.push(parent);
        }
        args.extend([hash.as_str(), "--"]);
        args
    };
    let (mut raw_diff, truncated) = read_git(repo, &diff_args("-p"), MAX_PATCH_BYTES, true)?;
    if truncated {
        // Never hand a partial hunk to the diff renderer. Keep complete files only.
        raw_diff.truncate(raw_diff.rfind("\ndiff --git ").unwrap_or(0));
    }
    let (names, _) = read_git(repo, &diff_args("--name-status"), MAX_METADATA_BYTES, false)?;
    let (stats, _) = read_git(repo, &diff_args("--numstat"), MAX_METADATA_BYTES, false)?;
    let stats = parse_numstat_z(&stats);
    let files = parse_name_status_z(&names)
        .into_iter()
        .map(|(status, path, old_path)| {
            let (additions, deletions, is_binary) = stats.get(&path).copied().unwrap_or_default();
            ChangedFile {
                path,
                old_path,
                status,
                additions,
                deletions,
                is_binary,
                is_conflicted: false,
            }
        })
        .collect();
    Ok(CommitDetail {
        hash: hash.clone(),
        parents,
        author_name: fields[2].into(),
        author_email: fields[3].into(),
        authored_date: fields[4].into(),
        message: fields[5].trim_end_matches(['\n', '\r']).into(),
        files,
        raw_diff,
        truncated,
    })
}

#[cfg(test)]
mod tests;
