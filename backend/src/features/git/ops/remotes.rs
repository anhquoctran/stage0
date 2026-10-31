use super::ref_validation::{
    validate_fetch_remote_url, validate_remote_name, validate_remote_name_syntax,
};
use super::remote_url::{is_supported_remote_url, validate_remote_url};
use super::GitRemoteDetail;
use crate::features::git::runner::{run_git, run_git_strict};

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
    Ok(crate::features::git::runner::redact_sensitive_text(
        res.trim(),
    ))
}

pub fn list_remotes_detailed(repo_path: &str) -> Result<Vec<GitRemoteDetail>, String> {
    let remotes = list_remotes(repo_path)?;
    let mut details = Vec::new();
    for name in remotes {
        let fetch_url = run_git(repo_path, &["remote", "get-url", &name])
            .map(|r| crate::features::git::runner::redact_sensitive_text(r.stdout.trim()))
            .unwrap_or_default();
        let push_url = run_git(repo_path, &["remote", "get-url", "--push", &name])
            .map(|r| crate::features::git::runner::redact_sensitive_text(r.stdout.trim()))
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
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlInvalid",
        ));
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
        return Err(crate::common::messages::failure(
            "backend.git.remoteConnectionFailed",
            serde_json::json!({}),
            crate::features::git::runner::redact_sensitive_text(err),
        ));
    }
    Ok(crate::common::messages::code("backend.git.connected"))
}

pub fn check_git_remote_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlRequired",
        ));
    }
    validate_remote_url(trimmed)?;

    let git_bin = crate::features::git::runner::get_active_git_path();
    let mut cmd = std::process::Command::new(&git_bin);
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_ASKPASS", "echo");
    cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");
    cmd.env("LC_ALL", "C");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    cmd.args(["ls-remote", "--exit-code", "-h", "--", trimmed]);
    let output = crate::common::process::run_bounded_command(
        &mut cmd,
        4 * 1024 * 1024,
        1024 * 1024,
        std::time::Duration::from_secs(120),
    )
    .map_err(|e| {
        crate::common::messages::failure(
            "backend.git.couldNotRunGit",
            serde_json::json!({ "error": e.to_string() }),
            format!("Could not run Git: {}", e),
        )
    })?;
    if output.output_truncated {
        return Err(crate::common::messages::code(
            "backend.git.remoteOutputTooLarge",
        ));
    }
    if !output.status.success() {
        let stderr = crate::features::git::runner::redact_sensitive_text(&String::from_utf8_lossy(
            &output.stderr,
        ));
        let err_lower = stderr.to_lowercase();
        let code = if err_lower.contains("repository not found") || err_lower.contains("not found")
        {
            "backend.git.remoteNotFound"
        } else if err_lower.contains("authentication failed")
            || err_lower.contains("permission denied")
        {
            "backend.git.remoteAccessDenied"
        } else if err_lower.contains("could not resolve host") {
            "backend.git.remoteHostUnresolved"
        } else {
            "backend.git.remoteUnavailable"
        };
        return Err(crate::common::messages::failure(
            code,
            serde_json::json!({}),
            stderr.trim().to_string(),
        ));
    }

    Ok(crate::common::messages::code("backend.git.cloneReady"))
}
