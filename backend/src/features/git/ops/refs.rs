use super::{
    ref_validation::{validate_branch_name, validate_tag_name},
    GitTagInfo,
};
use crate::features::git::runner::{resolve_ref, run_git, run_git_strict};

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
