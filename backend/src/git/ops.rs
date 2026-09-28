use super::runner::run_git;

pub fn git_sync(repo_path: &str, operation: &str) -> Result<String, String> {
    let args: Vec<&str> = match operation {
        "fetch" => vec!["fetch", "--all", "--prune"],
        "pull" => vec!["pull"],
        "rebase" => vec!["rebase"],
        other => return Err(format!("Unsupported sync operation: {}", other)),
    };

    let res = run_git(repo_path, &args)?;

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
