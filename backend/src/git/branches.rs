use super::runner::run_git_strict;
use super::BranchList;

pub fn list_branches(repo_path: &str) -> Result<BranchList, String> {
    // 1. Get current branch
    let current = match run_git_strict(repo_path, &["branch", "--show-current"]) {
        Ok(out) => out.trim().to_string(),
        Err(_) => match run_git_strict(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"]) {
            Ok(out) => out.trim().to_string(),
            Err(_) => "HEAD".to_string(),
        },
    };

    // 2. Enumerate local and remote refs
    let output = run_git_strict(
        repo_path,
        &[
            "for-each-ref",
            "--format=%(refname)|%(refname:short)",
            "refs/heads/",
            "refs/remotes/",
        ],
    )?;

    let mut local = Vec::new();
    let mut remote = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 2 {
            continue;
        }

        let full_ref = parts[0];
        let short_ref = parts[1].to_string();

        if full_ref.starts_with("refs/heads/") {
            if !local.contains(&short_ref) {
                local.push(short_ref);
            }
        } else if full_ref.starts_with("refs/remotes/") {
            // Ignore symbolic refs like origin/HEAD
            if !short_ref.ends_with("/HEAD") && !remote.contains(&short_ref) {
                remote.push(short_ref);
            }
        }
    }

    Ok(BranchList {
        current,
        local,
        remote,
    })
}

pub fn get_merge_base(repo_path: &str, base: &str, compare: &str) -> Result<String, String> {
    let out = run_git_strict(repo_path, &["merge-base", base, compare])?;
    Ok(out.trim().to_string())
}
