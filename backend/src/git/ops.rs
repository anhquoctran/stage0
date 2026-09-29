use super::runner::{run_git, run_git_strict};

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug, Default)]
pub struct GitSyncOptions {
    pub remote: Option<String>,
    pub branch: Option<String>,
    pub rebase: Option<bool>,
    pub autostash: Option<bool>,
    pub ff_only: Option<bool>,
    pub no_commit: Option<bool>,
    pub prune: Option<bool>,
}

pub fn list_remotes(repo_path: &str) -> Result<Vec<String>, String> {
    let res = run_git_strict(repo_path, &["remote"])?;
    Ok(res
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect())
}

pub fn get_remote_url(repo_path: &str, remote_name: Option<&str>) -> Result<String, String> {
    let remote = remote_name.unwrap_or("origin");
    let res = run_git_strict(repo_path, &["remote", "get-url", remote])?;
    Ok(res.trim().to_string())
}

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
                    if resolved.join("rebase-merge").exists() || resolved.join("rebase-apply").exists() {
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
    let mut args: Vec<String> = Vec::new();

    match operation {
        "fetch" => {
            args.push("fetch".to_string());
            let prune = options.as_ref().and_then(|o| o.prune).unwrap_or(true);
            if prune {
                args.push("--prune".to_string());
            }
            if let Some(opts) = options {
                if let Some(r) = opts.remote {
                    args.push(r);
                    if let Some(b) = opts.branch {
                        args.push(b);
                    }
                } else {
                    args.push("--all".to_string());
                }
            } else {
                args.push("--all".to_string());
            }
        }
        "pull" => {
            args.push("pull".to_string());
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
                    args.push(r.clone());
                    if let Some(ref b) = opts.branch {
                        let clean_b = if let Some(stripped) = b.strip_prefix(&format!("{}/", r)) {
                            stripped
                        } else {
                            b.as_str()
                        };
                        args.push(clean_b.to_string());
                    }
                }
            }
        }
        "rebase" => {
            args.push("rebase".to_string());
            if let Some(ref opts) = options {
                if opts.autostash == Some(true) {
                    args.push("--autostash".to_string());
                }
                if let Some(ref b) = opts.branch {
                    args.push(b.clone());
                }
            }
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
        other => return Err(format!("Unsupported sync operation: {}", other)),
    }

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let res = run_git(repo_path, &str_args)?;

    if !res.success {
        let err_msg = if !res.stderr.trim().is_empty() {
            res.stderr.trim()
        } else {
            res.stdout.trim()
        };
        return Err(format!("git {} failed: {}", operation, err_msg));
    }

    let out = if !res.stdout.trim().is_empty() {
        res.stdout
    } else if !res.stderr.trim().is_empty() {
        res.stderr
    } else {
        format!("git {} completed successfully.", operation)
    };

    Ok(out.trim().to_string())
}
