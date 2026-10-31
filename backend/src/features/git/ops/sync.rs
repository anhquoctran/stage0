use super::ref_validation::{
    validate_all_fetch_remote_urls, validate_branch_name, validate_fetch_remote_url,
};
use super::GitSyncOptions;
use crate::features::git::runner::resolve_ref;

pub fn is_rebase_in_progress(repo_path: &str) -> bool {
    let git_dir = std::path::Path::new(repo_path).join(".git");
    if git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists() {
        return true;
    }
    if git_dir.is_file() {
        if let Ok(content) = std::fs::read_to_string(&git_dir) {
            for line in content.lines() {
                if let Some(actual_git_dir) = line.strip_prefix("gitdir: ") {
                    let actual_path = std::path::Path::new(actual_git_dir.trim());
                    let resolved = if actual_path.is_absolute() {
                        actual_path.to_path_buf()
                    } else {
                        std::path::Path::new(repo_path).join(actual_path)
                    };
                    if resolved.join("rebase-merge").exists()
                        || resolved.join("rebase-apply").exists()
                    {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub fn git_sync(
    repo_path: &str,
    operation: &str,
    options: Option<GitSyncOptions>,
) -> Result<String, String> {
    git_sync_with_progress(repo_path, operation, options, None)
}

pub fn git_sync_with_progress(
    repo_path: &str,
    operation: &str,
    options: Option<GitSyncOptions>,
    on_progress: Option<tauri::ipc::Channel<crate::features::git::progress::GitOperationProgress>>,
) -> Result<String, String> {
    let mut args: Vec<String> = Vec::new();

    match operation {
        "fetch" => {
            args.push("fetch".to_string());
            args.push("--progress".to_string());
            let prune = options.as_ref().and_then(|o| o.prune).unwrap_or(true);
            if prune {
                args.push("--prune".to_string());
            }
            if let Some(opts) = options {
                if let Some(r) = opts.remote {
                    validate_fetch_remote_url(repo_path, &r)?;
                    args.push("--".to_string());
                    args.push(r);
                    if let Some(b) = opts.branch {
                        validate_branch_name(repo_path, &b)?;
                        args.push(b);
                    }
                } else {
                    validate_all_fetch_remote_urls(repo_path)?;
                    args.push("--all".to_string());
                }
            } else {
                validate_all_fetch_remote_urls(repo_path)?;
                args.push("--all".to_string());
            }
        }
        "pull" => {
            args.push("pull".to_string());
            args.push("--progress".to_string());
            if let Some(ref opts) = options {
                if opts.rebase == Some(true) {
                    args.push("--rebase".to_string());
                }
                if opts.autostash == Some(true) {
                    args.push("--autostash".to_string());
                }
                if opts.ff_only == Some(true) {
                    args.push("--ff-only".to_string());
                }
                if opts.no_commit == Some(true) {
                    args.push("--no-commit".to_string());
                }
                if let Some(ref r) = opts.remote {
                    validate_fetch_remote_url(repo_path, r)?;
                    // End option parsing before caller-controlled operands.
                    args.push("--".to_string());
                    args.push(r.clone());
                    if let Some(ref b) = opts.branch {
                        let clean_b = if let Some(stripped) = b.strip_prefix(&format!("{}/", r)) {
                            stripped
                        } else {
                            b.as_str()
                        };
                        validate_branch_name(repo_path, clean_b)?;
                        args.push(clean_b.to_string());
                    }
                } else {
                    validate_all_fetch_remote_urls(repo_path)?;
                }
            } else {
                validate_all_fetch_remote_urls(repo_path)?;
            }
        }
        "rebase" => {
            args.push("rebase".to_string());
            if let Some(ref opts) = options {
                if opts.autostash == Some(true) {
                    args.push("--autostash".to_string());
                }
                if let Some(ref b) = opts.branch {
                    // Never pass an untrusted branch string in Git's option
                    // position: `rebase --exec=...` executes a local command.
                    let (commit, _) = resolve_ref(repo_path, b)?;
                    args.push(commit);
                }
            }
        }
        "merge" => {
            args.push("merge".to_string());
            args.push("--progress".to_string());
            let opts = options.as_ref();
            let no_ff = opts.and_then(|o| o.no_ff).unwrap_or(false);
            let ff_only = opts.and_then(|o| o.ff_only).unwrap_or(false);
            if no_ff && ff_only {
                return Err(crate::common::messages::code(
                    "backend.git.mergeConflictingOptions",
                ));
            }
            if no_ff {
                args.push("--no-ff".to_string());
            }
            if ff_only {
                args.push("--ff-only".to_string());
            }
            if opts.and_then(|o| o.no_commit) == Some(true) {
                args.push("--no-commit".to_string());
            }
            if opts.and_then(|o| o.squash) == Some(true) {
                args.push("--squash".to_string());
            }

            let branch = opts
                .and_then(|o| o.branch.as_deref())
                .unwrap_or("@{upstream}");
            let (commit, _) = resolve_ref(repo_path, branch).map_err(|error| {
                if branch == "@{upstream}" {
                    crate::common::messages::failure(
                        "backend.git.upstreamUnresolved",
                        serde_json::json!({ "error": error }),
                        format!("Could not determine the current branch's upstream: {error}"),
                    )
                } else {
                    error
                }
            })?;
            args.push(commit);
        }
        "rebase_continue" => {
            args.push("rebase".to_string());
            args.push("--continue".to_string());
        }
        "rebase_abort" => {
            args.push("rebase".to_string());
            args.push("--abort".to_string());
        }
        "rebase_skip" => {
            args.push("rebase".to_string());
            args.push("--skip".to_string());
        }
        other => {
            return Err(crate::common::messages::message(
                "backend.git.unsupportedSyncOp",
                serde_json::json!({ "operation": other }),
            ))
        }
    }

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let reporter = crate::features::git::progress::GitProgressReporter::new(on_progress);
    let res = crate::features::git::runner::run_git_with_progress(repo_path, &str_args, &reporter)?;

    if !res.success {
        let err_msg = if !res.stderr.trim().is_empty() {
            res.stderr.trim()
        } else {
            res.stdout.trim()
        };
        let redacted = crate::features::git::runner::redact_sensitive_text(err_msg);
        return Err(crate::common::messages::failure(
            "backend.git.operationFailed",
            serde_json::json!({ "operation": operation, "error": redacted }),
            format!("Git {} failed: {}", operation, redacted),
        ));
    }

    let out = if !res.stdout.trim().is_empty() {
        res.stdout
    } else if !res.stderr.trim().is_empty() {
        res.stderr
    } else {
        format!("git {} completed successfully.", operation)
    };

    Ok(crate::features::git::runner::redact_sensitive_text(
        out.trim(),
    ))
}
