use super::runner::{resolve_ref, run_git, run_git_strict};

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
    validate_remote_name(repo_path, remote)?;
    let res = run_git_strict(repo_path, &["remote", "get-url", remote])?;
    Ok(super::runner::redact_sensitive_text(res.trim()))
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
        return Err(format!(
            "Git {} failed: {}",
            operation,
            super::runner::redact_sensitive_text(err_msg)
        ));
    }

    let out = if !res.stdout.trim().is_empty() {
        res.stdout
    } else if !res.stderr.trim().is_empty() {
        res.stderr
    } else {
        format!("git {} completed successfully.", operation)
    };

    Ok(super::runner::redact_sensitive_text(out.trim()))
}

fn validate_remote_name(repo_path: &str, name: &str) -> Result<(), String> {
    validate_remote_name_syntax(name)?;
    let remotes = list_remotes(repo_path)?;
    if !remotes.iter().any(|remote| remote == name) {
        return Err("The selected Git remote does not exist".to_string());
    }
    Ok(())
}

fn validate_fetch_remote_url(repo_path: &str, name: &str) -> Result<(), String> {
    validate_remote_name(repo_path, name)?;
    let urls = run_git_strict(repo_path, &["remote", "get-url", "--all", name])?;
    let urls: Vec<&str> = urls
        .lines()
        .map(str::trim)
        .filter(|url| !url.is_empty())
        .collect();
    if urls.is_empty() {
        return Err("The selected Git remote has no fetch URL".to_string());
    }
    for url in urls {
        validate_remote_url(url)?;
    }
    Ok(())
}

fn validate_all_fetch_remote_urls(repo_path: &str) -> Result<(), String> {
    for remote in list_remotes(repo_path)? {
        validate_fetch_remote_url(repo_path, &remote)?;
    }
    Ok(())
}

fn validate_remote_name_syntax(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.starts_with('-')
        || name.ends_with('.')
        || name.ends_with(".lock")
        || name.contains("..")
        || name
            .chars()
            .any(|c| c.is_control() || c.is_whitespace() || c == '/')
    {
        return Err("Invalid Git remote name".to_string());
    }
    Ok(())
}

fn validate_branch_name(repo_path: &str, name: &str) -> Result<(), String> {
    if name.is_empty() || name.starts_with('-') {
        return Err("Invalid Git branch name".to_string());
    }
    let check = run_git(repo_path, &["check-ref-format", "--branch", name])?;
    if !check.success {
        return Err("Invalid Git branch name".to_string());
    }
    Ok(())
}

fn validate_tag_name(repo_path: &str, name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.starts_with('-')
        || name.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("Invalid Git tag name".to_string());
    }
    let full_ref = format!("refs/tags/{}", name);
    let check = run_git(repo_path, &["check-ref-format", &full_ref])?;
    if !check.success {
        return Err("Invalid Git tag name".to_string());
    }
    Ok(())
}

fn is_supported_remote_url(value: &str) -> bool {
    validate_remote_url(value).is_ok()
}

pub fn validate_remote_url(value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty()
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
        || value.contains('?')
        || value.contains('#')
    {
        return Err("Remote URL must be a non-empty HTTPS or SSH URL without whitespace, query, or fragment data".to_string());
    }

    if value.starts_with("git@") {
        let Some((host, path)) = value[4..].rsplit_once(':') else {
            return Err("SSH remote URL must include a host and repository path".to_string());
        };
        if path.is_empty() || host.contains('@') {
            return Err("SSH remote URL must include a valid host and repository path".to_string());
        }
        validate_ssh_host(host, false)?;
        return Ok(());
    }

    let Some((scheme, remainder)) = value.split_once("://") else {
        return Err("Remote URL must use HTTPS or SSH (for example, https://host/repo.git or git@host:repo.git)".to_string());
    };
    if !matches!(
        scheme.to_ascii_lowercase().as_str(),
        "https" | "http" | "ssh"
    ) {
        return Err("Only HTTPS, HTTP, and SSH Git remote URLs are supported".to_string());
    }

    let authority = remainder.split('/').next().unwrap_or_default();
    let host = if scheme.eq_ignore_ascii_case("ssh") {
        if let Some((user, host)) = authority.split_once('@') {
            if !is_safe_ssh_user(user) || host.is_empty() || host.contains('@') {
                return Err(
                    "SSH remote URL must not contain a password or malformed user information"
                        .to_string(),
                );
            }
            host
        } else {
            authority
        }
    } else {
        if authority.contains('@') {
            return Err(
                "Remote URL must not embed credentials; use the OS credential store instead"
                    .to_string(),
            );
        }
        authority
    };
    if host.is_empty() {
        return Err("Remote URL must have a host and must not embed credentials; use the OS credential store instead".to_string());
    }
    if scheme.eq_ignore_ascii_case("ssh") {
        validate_ssh_host(host, true)?;
        if remainder
            .split_once('/')
            .map_or(true, |(_, path)| path.is_empty())
        {
            return Err("SSH remote URL must include a repository path".to_string());
        }
    }

    Ok(())
}

fn is_safe_ssh_user(user: &str) -> bool {
    !user.is_empty()
        && user
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_alphanumeric() || matches!(first, '_' | '.'))
        && user.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
}

fn validate_ssh_host(host: &str, allow_port: bool) -> Result<(), String> {
    let invalid = || "SSH remote URL must use a valid host, not an option-like value".to_string();
    let is_ipv6 = host.starts_with('[');
    let (host_name, port) = if let Some(ipv6_and_suffix) = host.strip_prefix('[') {
        let (ipv6, suffix) = ipv6_and_suffix.split_once(']').ok_or_else(invalid)?;
        ipv6.parse::<std::net::Ipv6Addr>().map_err(|_| invalid())?;
        let port = if suffix.is_empty() {
            None
        } else if allow_port {
            Some(suffix.strip_prefix(':').ok_or_else(invalid)?)
        } else {
            return Err(invalid());
        };
        (ipv6, port)
    } else if let Some((name, port)) = host.split_once(':') {
        if !allow_port || name.contains(':') {
            return Err(invalid());
        }
        (name, Some(port))
    } else {
        (host, None)
    };

    if host_name.is_empty()
        || host_name.starts_with('-')
        || (!is_ipv6
            && !host_name.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
            }))
        || port.is_some_and(|port| port.is_empty() || !port.chars().all(|c| c.is_ascii_digit()))
    {
        return Err(invalid());
    }
    Ok(())
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
            .map(|r| super::runner::redact_sensitive_text(r.stdout.trim()))
            .unwrap_or_default();
        let push_url = run_git(repo_path, &["remote", "get-url", "--push", &name])
            .map(|r| super::runner::redact_sensitive_text(r.stdout.trim()))
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
    validate_remote_name_syntax(name)?;
    validate_remote_url(url)?;
    run_git_strict(repo_path, &["remote", "add", "--", name, url])?;
    Ok(())
}

pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), String> {
    validate_remote_name(repo_path, name)?;
    run_git_strict(repo_path, &["remote", "remove", "--", name])?;
    Ok(())
}

pub fn set_remote_url(repo_path: &str, name: &str, url: &str) -> Result<(), String> {
    validate_remote_name(repo_path, name)?;
    validate_remote_url(url)?;
    run_git_strict(repo_path, &["remote", "set-url", "--", name, url])?;
    Ok(())
}

pub fn test_remote_connection(repo_path: &str, remote_or_url: &str) -> Result<String, String> {
    let known_remote = list_remotes(repo_path)?
        .iter()
        .any(|remote| remote == remote_or_url);
    if known_remote {
        validate_fetch_remote_url(repo_path, remote_or_url)?;
    } else if !is_supported_remote_url(remote_or_url) {
        return Err("Remote must be a configured remote or an HTTPS/SSH Git URL".to_string());
    }
    let res = run_git(
        repo_path,
        &["ls-remote", "--exit-code", "--", remote_or_url, "HEAD"],
    )?;
    if !res.success {
        let err = if !res.stderr.trim().is_empty() {
            res.stderr.trim()
        } else {
            "Connection test failed or permission denied."
        };
        return Err(format!(
            "Remote connection failed: {}",
            super::runner::redact_sensitive_text(err)
        ));
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
    let res = run_git(
        repo_path,
        &[
            "tag",
            "--sort=-creatordate",
            &format!("--format={}", format),
        ],
    )?;
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
        let commit_hash = parts
            .get(1)
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let date = parts
            .get(2)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let message = parts
            .get(3)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

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
    validate_tag_name(repo_path, tag_name)?;
    let resolved_commit = commit_ref
        .map(|r| resolve_ref(repo_path, r).map(|(commit, _)| commit))
        .transpose()?;
    let mut args = vec!["tag"];
    if let Some(msg) = message {
        if !msg.trim().is_empty() {
            args.push("-a");
            args.push(tag_name);
            args.push("-m");
            args.push(msg);
            if let Some(c) = resolved_commit.as_deref() {
                args.push(c);
            }
            run_git_strict(repo_path, &args)?;
            return Ok(());
        }
    }

    args.push(tag_name);
    if let Some(c) = resolved_commit.as_deref() {
        args.push(c);
    }
    run_git_strict(repo_path, &args)?;
    Ok(())
}

pub fn delete_tag(repo_path: &str, tag_name: &str) -> Result<(), String> {
    validate_tag_name(repo_path, tag_name)?;
    run_git_strict(repo_path, &["tag", "-d", tag_name])?;
    Ok(())
}

pub fn create_branch(
    repo_path: &str,
    branch_name: &str,
    start_point: Option<&str>,
) -> Result<(), String> {
    validate_branch_name(repo_path, branch_name)?;
    let resolved_start = start_point
        .map(|r| resolve_ref(repo_path, r).map(|(commit, _)| commit))
        .transpose()?;
    let mut args = vec!["branch", branch_name];
    if let Some(sp) = resolved_start.as_deref() {
        args.push(sp);
    }
    run_git_strict(repo_path, &args)?;
    Ok(())
}

pub fn delete_branch(repo_path: &str, branch_name: &str, force: bool) -> Result<(), String> {
    validate_branch_name(repo_path, branch_name)?;
    let flag = if force { "-D" } else { "-d" };
    run_git_strict(repo_path, &["branch", flag, branch_name])?;
    Ok(())
}

pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    validate_branch_name(repo_path, old_name)?;
    validate_branch_name(repo_path, new_name)?;
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
    let output = run_git_strict(repo_path, &["log", &range, &format_arg, "--no-merges"])?;

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
    validate_remote_url(trimmed)?;

    let git_bin = crate::git::runner::get_active_git_path();
    let mut cmd = std::process::Command::new(&git_bin);
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_ASKPASS", "echo");
    cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    cmd.args(["ls-remote", "--exit-code", "-h", "--", trimmed]);
    let output = crate::process::run_bounded_command(
        &mut cmd,
        4 * 1024 * 1024,
        1024 * 1024,
        std::time::Duration::from_secs(120),
    )
    .map_err(|e| format!("Không thể chạy lệnh git: {}", e))?;
    if output.output_truncated {
        return Err("Git remote check produced too much output and was stopped.".to_string());
    }
    if !output.status.success() {
        let stderr =
            crate::git::runner::redact_sensitive_text(&String::from_utf8_lossy(&output.stderr));
        let err_lower = stderr.to_lowercase();
        let message =
            if err_lower.contains("repository not found") || err_lower.contains("not found") {
                "Repository không tồn tại hoặc ở chế độ riêng tư (404 Not Found)."
            } else if err_lower.contains("authentication failed")
                || err_lower.contains("permission denied")
            {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_credentials_are_redacted_from_ipc_metadata() {
        let temp_dir =
            std::env::temp_dir().join(format!("remote_redaction_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let repo_path = temp_dir.to_string_lossy().to_string();
        let init = std::process::Command::new("git")
            .current_dir(&repo_path)
            .args(["init", "-q"])
            .status()
            .unwrap();
        assert!(init.success());

        std::process::Command::new("git")
            .current_dir(&repo_path)
            .args([
                "remote",
                "add",
                "origin",
                "https://user:pass@example.test/repo?access_token=supersecret",
            ])
            .status()
            .unwrap();
        let details = list_remotes_detailed(&repo_path).unwrap();
        assert_eq!(details.len(), 1);
        for secret in ["user:pass", "supersecret"] {
            assert!(!details[0].fetch_url.contains(secret));
            assert!(!get_remote_url(&repo_path, Some("origin"))
                .unwrap()
                .contains(secret));
        }
        assert!(details[0].fetch_url.contains("[REDACTED]"));

        std::fs::remove_dir_all(temp_dir).unwrap();
    }

    #[test]
    fn rejects_urls_that_embed_secrets_or_select_external_transport_helpers() {
        for url in [
            "https://user:token@example.test/repo.git",
            "https://example.test/repo.git?access_token=secret",
            "ext::sh -c touch% /tmp/pwned",
            "file:///tmp/repo.git",
            "git@-oProxyCommand=touch:owner/repo.git",
            "ssh://-oProxyCommand=touch@host/owner/repo.git",
            "ssh://git@-oProxyCommand=touch/owner/repo.git",
            "ssh://git@example.test",
        ] {
            assert!(validate_remote_url(url).is_err(), "accepted {url:?}");
        }
        assert!(validate_remote_url("https://example.test/owner/repo.git").is_ok());
        assert!(validate_remote_url("git@example.test:owner/repo.git").is_ok());
        assert!(validate_remote_url("git@[::1]:owner/repo.git").is_ok());
        assert!(validate_remote_url("ssh://git@example.test/owner/repo.git").is_ok());
        assert!(validate_remote_url("ssh://git@[::1]:2222/owner/repo.git").is_ok());
    }

    #[test]
    fn rebase_does_not_accept_git_options_as_a_branch_argument() {
        let temp_dir =
            std::env::temp_dir().join(format!("rebase_option_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let repo_path = temp_dir.to_string_lossy().to_string();
        let result = git_sync(
            &repo_path,
            "rebase",
            Some(GitSyncOptions {
                branch: Some("--exec=touch /tmp/stage0-should-not-exist".to_string()),
                ..GitSyncOptions::default()
            }),
        );
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn fetch_refuses_option_like_ssh_hosts_from_existing_remote_config() {
        let temp_dir =
            std::env::temp_dir().join(format!("ssh_remote_option_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let repo_path = temp_dir.to_string_lossy().to_string();
        let init = std::process::Command::new("git")
            .current_dir(&repo_path)
            .args(["init", "-q"])
            .status()
            .unwrap();
        assert!(init.success());
        let add_remote = std::process::Command::new("git")
            .current_dir(&repo_path)
            .args([
                "remote",
                "add",
                "origin",
                "ssh://git@-oProxyCommand=touch/owner/repo.git",
            ])
            .status()
            .unwrap();
        assert!(add_remote.success());

        let error = git_sync(
            &repo_path,
            "fetch",
            Some(GitSyncOptions {
                remote: Some("origin".to_string()),
                ..GitSyncOptions::default()
            }),
        )
        .unwrap_err();
        assert!(error.contains("option-like"));
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
