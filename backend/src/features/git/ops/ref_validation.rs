use super::{remote_url::validate_remote_url, remotes::list_remotes};
use crate::features::git::runner::{run_git, run_git_strict};

pub(super) fn validate_remote_name(repo_path: &str, name: &str) -> Result<(), String> {
    validate_remote_name_syntax(name)?;
    let remotes = list_remotes(repo_path)?;
    if !remotes.iter().any(|remote| remote == name) {
        return Err("The selected Git remote does not exist".to_string());
    }
    Ok(())
}

pub(super) fn validate_fetch_remote_url(repo_path: &str, name: &str) -> Result<(), String> {
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

pub(super) fn validate_all_fetch_remote_urls(repo_path: &str) -> Result<(), String> {
    for remote in list_remotes(repo_path)? {
        validate_fetch_remote_url(repo_path, &remote)?;
    }
    Ok(())
}

pub(super) fn validate_remote_name_syntax(name: &str) -> Result<(), String> {
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

pub(super) fn validate_branch_name(repo_path: &str, name: &str) -> Result<(), String> {
    if name.is_empty() || name.starts_with('-') {
        return Err("Invalid Git branch name".to_string());
    }
    let check = run_git(repo_path, &["check-ref-format", "--branch", name])?;
    if !check.success {
        return Err("Invalid Git branch name".to_string());
    }
    Ok(())
}

pub(super) fn validate_tag_name(repo_path: &str, name: &str) -> Result<(), String> {
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
