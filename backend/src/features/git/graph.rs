use super::runner::{run_git, run_git_strict};
use serde::Serialize;

const GRAPH_COMMIT_LIMIT: usize = 200;

#[derive(Debug, Serialize, Clone)]
pub struct GitGraph {
    pub branch: String,
    pub is_detached: bool,
    pub truncated: bool,
    pub commits: Vec<GitGraphCommit>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitGraphCommit {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub subject: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: String,
    pub refs: Vec<String>,
}

/// Returns structured commit ancestry for the repository's checked-out HEAD.
/// The command only reads repository history and never changes refs or the
/// working tree.
pub fn get_current_branch_graph(repo_path: &str) -> Result<GitGraph, String> {
    // Validate the repository first so an invalid path is not mistaken for a
    // detached or unborn HEAD.
    run_git_strict(repo_path, &["rev-parse", "--git-dir"])?;

    let branch_result = run_git(repo_path, &["symbolic-ref", "--quiet", "--short", "HEAD"])?;
    let is_detached = !branch_result.success || branch_result.stdout.trim().is_empty();
    let branch = if is_detached {
        "HEAD".to_string()
    } else {
        branch_result.stdout.trim().to_string()
    };

    let head_result = run_git(repo_path, &["rev-parse", "--verify", "--quiet", "HEAD"])?;
    if !head_result.success {
        if !is_detached {
            // A newly initialized repository has a symbolic branch but no
            // commit yet. It has a valid, empty graph rather than an error.
            return Ok(GitGraph {
                branch,
                is_detached,
                truncated: false,
                commits: Vec::new(),
            });
        }
        return Err("Git could not resolve the repository's current HEAD".to_string());
    }

    // Read one extra record so the UI can accurately indicate when history is
    // capped. HEAD is fixed here; no user-provided ref reaches Git's options.
    let format = "%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1e";
    let format_arg = format!("--format={}", format);
    let max_count_arg = format!("--max-count={}", GRAPH_COMMIT_LIMIT + 1);
    let output = run_git_strict(
        repo_path,
        &[
            "log",
            "--topo-order",
            "--decorate=short",
            &format_arg,
            &max_count_arg,
            "HEAD",
        ],
    )?;

    let mut commits = Vec::new();
    for record in output.split('\x1e') {
        let record = record.trim_matches(['\n', '\r']);
        if record.is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\x1f').collect();
        if fields.len() != 8 {
            return Err("Git returned malformed commit graph data".to_string());
        }
        commits.push(GitGraphCommit {
            hash: fields[0].to_string(),
            short_hash: fields[1].to_string(),
            parents: fields[2].split_whitespace().map(str::to_string).collect(),
            author_name: fields[3].to_string(),
            author_email: fields[4].to_string(),
            authored_date: fields[5].to_string(),
            refs: fields[6]
                .split(", ")
                .map(str::trim)
                .filter(|reference| !reference.is_empty())
                .map(str::to_string)
                .collect(),
            subject: fields[7].to_string(),
        });
    }

    let truncated = commits.len() > GRAPH_COMMIT_LIMIT;
    commits.truncate(GRAPH_COMMIT_LIMIT);

    Ok(GitGraph {
        branch,
        is_detached,
        truncated,
        commits,
    })
}

/// Loads the complete commit message for a selected commit. The hash is
/// validated and resolved to a commit object before it is passed to Git.
pub fn get_commit_message(repo_path: &str, commit_hash: &str) -> Result<String, String> {
    if !matches!(commit_hash.len(), 40 | 64)
        || !commit_hash
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("Invalid commit hash".to_string());
    }

    let (commit_oid, _) = super::runner::resolve_ref(repo_path, commit_hash)?;
    let message = run_git_strict(
        repo_path,
        &[
            "show",
            "-s",
            "--format=%B",
            "--no-show-signature",
            &commit_oid,
        ],
    )?;
    Ok(message.trim_end_matches(['\n', '\r']).to_string())
}

/// Searches commit subjects and bodies on the checked-out branch and returns
/// matching commit object IDs. The result is capped because the graph UI only
/// displays a bounded portion of history.
pub fn search_commit_messages(
    repo_path: &str,
    query: &str,
    case_sensitive: bool,
    commit_hashes: &[String],
) -> Result<Vec<String>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    if query.chars().count() > 256 || query.chars().any(char::is_control) {
        return Err(
            "Search text must be 256 characters or fewer and contain no control characters"
                .to_string(),
        );
    }
    if commit_hashes.len() > GRAPH_COMMIT_LIMIT
        || commit_hashes.iter().any(|hash| {
            !matches!(hash.len(), 40 | 64)
                || !hash.chars().all(|character| character.is_ascii_hexdigit())
        })
    {
        return Err("Invalid commit list for search".to_string());
    }
    if commit_hashes.is_empty() {
        return Ok(Vec::new());
    }

    let grep_arg = format!("--grep={}", query);
    let mut args = vec!["log", "--no-walk", "--format=%H", "--fixed-strings"];
    if !case_sensitive {
        args.push("--regexp-ignore-case");
    }
    args.push(&grep_arg);
    args.extend(commit_hashes.iter().map(String::as_str));

    let output = run_git_strict(repo_path, &args)?;
    Ok(output
        .lines()
        .map(str::trim)
        .filter(|hash| {
            matches!(hash.len(), 40 | 64)
                && hash.chars().all(|character| character.is_ascii_hexdigit())
        })
        .map(str::to_string)
        .collect())
}
