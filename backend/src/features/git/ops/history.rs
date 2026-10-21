use super::GitCommitItem;
use crate::features::git::runner::{resolve_ref, run_git, run_git_strict};

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
