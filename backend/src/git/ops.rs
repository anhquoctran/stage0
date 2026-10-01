use super::runner::{run_git, run_git_strict, resolve_ref};

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

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitRemoteDetail {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

pub fn list_remotes_detailed(repo_path: &str) -> Result<Vec<GitRemoteDetail>, String> {
    let remotes = list_remotes(repo_path)?;
    let mut details = Vec::new();
    for name in remotes {
        let fetch_url = run_git(repo_path, &["remote", "get-url", &name])
            .map(|r| r.stdout.trim().to_string())
            .unwrap_or_default();
        let push_url = run_git(repo_path, &["remote", "get-url", "--push", &name])
            .map(|r| r.stdout.trim().to_string())
            .unwrap_or_else(|_| fetch_url.clone());
        details.push(GitRemoteDetail {
            name,
            fetch_url,
            push_url,
        });
    }
    Ok(details)
}

pub fn add_remote(repo_path: &str, name: &str, url: &str) -> Result<(), String> {
    run_git_strict(repo_path, &["remote", "add", name, url])?;
    Ok(())
}

pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), String> {
    run_git_strict(repo_path, &["remote", "remove", name])?;
    Ok(())
}

pub fn set_remote_url(repo_path: &str, name: &str, url: &str) -> Result<(), String> {
    run_git_strict(repo_path, &["remote", "set-url", name, url])?;
    Ok(())
}

pub fn test_remote_connection(repo_path: &str, remote_or_url: &str) -> Result<String, String> {
    let res = run_git(repo_path, &["ls-remote", "--exit-code", remote_or_url, "HEAD"])?;
    if !res.success {
        let err = if !res.stderr.trim().is_empty() {
            res.stderr.trim()
        } else {
            "Connection test failed or permission denied."
        };
        return Err(format!("Remote connection failed: {}", err));
    }
    Ok("Connection successful! Remote repository is accessible.".to_string())
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitTagInfo {
    pub name: String,
    pub commit_hash: String,
    pub message: Option<String>,
    pub date: Option<String>,
}

pub fn list_tags_detailed(repo_path: &str) -> Result<Vec<GitTagInfo>, String> {
    // Format: refname:short|objectname:short|creatordate:iso|contents:subject
    let format = "%(refname:short)|%(objectname:short)|%(creatordate:iso)|%(contents:subject)";
    let res = run_git(repo_path, &["tag", "--sort=-creatordate", &format!("--format={}", format)])?;
    if !res.success {
        return Ok(Vec::new());
    }

    let mut tags = Vec::new();
    for line in res.stdout.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.is_empty() || parts[0].trim().is_empty() {
            continue;
        }
        let name = parts[0].trim().to_string();
        let commit_hash = parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default();
        let date = parts.get(2).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let message = parts.get(3).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

        tags.push(GitTagInfo {
            name,
            commit_hash,
            message,
            date,
        });
    }
    Ok(tags)
}

pub fn create_tag(
    repo_path: &str,
    tag_name: &str,
    commit_ref: Option<&str>,
    message: Option<&str>,
) -> Result<(), String> {
    let mut args = vec!["tag"];
    if let Some(msg) = message {
        if !msg.trim().is_empty() {
            args.push("-a");
            args.push(tag_name);
            args.push("-m");
            args.push(msg);
            if let Some(c) = commit_ref {
                args.push(c);
            }
            run_git_strict(repo_path, &args)?;
            return Ok(());
        }
    }

    args.push(tag_name);
    if let Some(c) = commit_ref {
        args.push(c);
    }
    run_git_strict(repo_path, &args)?;
    Ok(())
}

pub fn delete_tag(repo_path: &str, tag_name: &str) -> Result<(), String> {
    run_git_strict(repo_path, &["tag", "-d", tag_name])?;
    Ok(())
}

pub fn create_branch(
    repo_path: &str,
    branch_name: &str,
    start_point: Option<&str>,
) -> Result<(), String> {
    let mut args = vec!["branch", branch_name];
    if let Some(sp) = start_point {
        args.push(sp);
    }
    run_git_strict(repo_path, &args)?;
    Ok(())
}

pub fn delete_branch(repo_path: &str, branch_name: &str, force: bool) -> Result<(), String> {
    let flag = if force { "-D" } else { "-d" };
    run_git_strict(repo_path, &["branch", flag, branch_name])?;
    Ok(())
}

pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    run_git_strict(repo_path, &["branch", "-m", old_name, new_name])?;
    Ok(())
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct GitCommitItem {
    pub hash: String,
    pub short_hash: String,
    pub subject: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: String,
}

pub fn get_commits_between(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<Vec<GitCommitItem>, String> {
    let (_, effective_base) = resolve_ref(repo_path, base)?;
    let (_, effective_compare) = resolve_ref(repo_path, compare)?;
    let range = format!("{}..{}", effective_base, effective_compare);
    // Use %x1f as field separator and %x1e as record separator
    let format = "%H%x1f%h%x1f%s%x1f%b%x1f%an%x1f%ae%x1f%aI%x1e";
    let format_arg = format!("--format={}", format);
    let output = run_git_strict(
        repo_path,
        &["log", &range, &format_arg, "--no-merges"],
    )?;

    let mut commits = Vec::new();
    for record in output.split('\x1e') {
        let trimmed = record.trim();
        if trimmed.is_empty() {
            continue;
        }
        let fields: Vec<&str> = trimmed.split('\x1f').collect();
        if fields.len() < 7 {
            continue;
        }
        commits.push(GitCommitItem {
            hash: fields[0].to_string(),
            short_hash: fields[1].to_string(),
            subject: fields[2].to_string(),
            body: if fields[3].trim().is_empty() {
                None
            } else {
                Some(fields[3].trim().to_string())
            },
            author_name: fields[4].to_string(),
            author_email: fields[5].to_string(),
            authored_date: fields[6].to_string(),
        });
    }

    Ok(commits)
}

pub fn get_git_user_identity(repo_path: &str) -> Result<(String, String), String> {
    let name_res = run_git(repo_path, &["config", "user.name"]);
    let email_res = run_git(repo_path, &["config", "user.email"]);

    let name = match name_res {
        Ok(r) if r.success && !r.stdout.trim().is_empty() => r.stdout.trim().to_string(),
        _ => "Local User".to_string(),
    };

    let email = match email_res {
        Ok(r) if r.success && !r.stdout.trim().is_empty() => r.stdout.trim().to_string(),
        _ => "user@local.stage0".to_string(),
    };

    Ok((name, email))
}

pub fn check_git_remote_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Vui lòng nhập repository URL.".to_string());
    }

    let is_valid_format = trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("git@")
        || trimmed.starts_with("ssh://");

    if !is_valid_format {
        return Err("Định dạng URL không hợp lệ (cần bắt đầu bằng https://, git@ hoặc ssh://)".to_string());
    }

    let git_bin = crate::git::runner::get_active_git_path();
    let mut cmd = std::process::Command::new(&git_bin);
    cmd.args(&["ls-remote", "--exit-code", "-h", trimmed]);
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_ASKPASS", "echo");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Không thể chạy lệnh git: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let err_lower = stderr.to_lowercase();
        let message = if err_lower.contains("repository not found") || err_lower.contains("not found") {
            "Repository không tồn tại hoặc ở chế độ riêng tư (404 Not Found)."
        } else if err_lower.contains("authentication failed") || err_lower.contains("permission denied") {
            "Bị từ chối truy cập (cần quyền hoặc xác thực tài khoản SSH/Token)."
        } else if err_lower.contains("could not resolve host") {
            "Không thể phân giải tên miền host. Vui lòng kiểm tra kết nối mạng."
        } else if !stderr.trim().is_empty() {
            stderr.trim()
        } else {
            "Không thể kết nối hoặc repository không khả dụng để clone."
        };
        return Err(message.to_string());
    }

    Ok("Repository hợp lệ và sẵn sàng để clone.".to_string())
}
