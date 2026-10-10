mod blame_commit;
pub use blame_commit::BlameCommit;
mod blame_line;
pub use blame_line::BlameLine;
mod blame_author_stat;
pub use blame_author_stat::BlameAuthorStat;
mod file_blame_payload;
pub use file_blame_payload::FileBlamePayload;

use super::runner::run_git;
use std::collections::HashMap;

pub fn get_file_blame(
    repo_path: &str,
    file_path: &str,
    revision: Option<&str>,
    ignore_whitespace: Option<bool>,
) -> Result<FileBlamePayload, String> {
    let clean_path = file_path.replace('\\', "/");
    super::resolve_safe_repo_path(repo_path, &clean_path)?;

    let mut args: Vec<String> = vec![
        "--literal-pathspecs".to_string(),
        "blame".to_string(),
        "--line-porcelain".to_string(),
    ];

    if ignore_whitespace.unwrap_or(false) {
        args.push("-w".to_string());
    }

    let effective_rev = revision
        .filter(|r| !r.trim().is_empty())
        .map(|rev| super::runner::resolve_ref(repo_path, rev).map(|(commit, _)| commit))
        .transpose()?;
    if let Some(rev) = effective_rev.as_deref() {
        args.push(rev.to_string());
    }

    args.push("--".to_string());
    args.push(clean_path.clone());

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let res = run_git(repo_path, &str_args)?;

    if !res.success {
        let err = if !res.stderr.trim().is_empty() {
            res.stderr.trim()
        } else {
            res.stdout.trim()
        };
        return Err(format!(
            "Git blame failed: {}",
            super::runner::redact_sensitive_text(err)
        ));
    }

    let current_user_name = run_git(repo_path, &["config", "user.name"])
        .ok()
        .filter(|r| r.success)
        .map(|r| r.stdout.trim().to_string())
        .filter(|s| !s.is_empty());

    let current_user_email = run_git(repo_path, &["config", "user.email"])
        .ok()
        .filter(|r| r.success)
        .map(|r| r.stdout.trim().to_string())
        .filter(|s| !s.is_empty());

    let mut payload = parse_blame_porcelain(
        &res.stdout,
        &clean_path,
        effective_rev.as_deref().unwrap_or("HEAD"),
    );
    payload.current_user_name = current_user_name;
    payload.current_user_email = current_user_email;

    Ok(payload)
}

pub fn parse_blame_porcelain(output: &str, file_path: &str, revision: &str) -> FileBlamePayload {
    let mut commits: HashMap<String, BlameCommit> = HashMap::new();
    let mut lines: Vec<BlameLine> = Vec::new();

    let mut current_sha = String::new();
    let mut current_orig_line: usize = 0;
    let mut current_final_line: usize = 0;

    let mut cur_author = String::new();
    let mut cur_author_mail = String::new();
    let mut cur_author_time: i64 = 0;
    let mut cur_author_tz = String::new();
    let mut cur_committer = String::new();
    let mut cur_committer_mail = String::new();
    let mut cur_committer_time: i64 = 0;
    let mut cur_summary = String::new();
    let mut cur_previous: Option<String> = None;

    for line in output.lines() {
        if let Some(content) = line.strip_prefix('\t') {
            // Line content
            if !current_sha.is_empty() && !commits.contains_key(&current_sha) {
                commits.insert(
                    current_sha.clone(),
                    BlameCommit {
                        commit_id: current_sha.clone(),
                        author: if cur_author.is_empty() {
                            "Unknown".to_string()
                        } else {
                            cur_author.clone()
                        },
                        author_mail: cur_author_mail.clone(),
                        author_time: cur_author_time,
                        author_tz: cur_author_tz.clone(),
                        committer: cur_committer.clone(),
                        committer_mail: cur_committer_mail.clone(),
                        committer_time: cur_committer_time,
                        summary: if cur_summary.is_empty() {
                            "(no commit message)".to_string()
                        } else {
                            cur_summary.clone()
                        },
                        previous_commit: cur_previous.take(),
                    },
                );
            }

            lines.push(BlameLine {
                line_no: current_final_line,
                orig_line_no: current_orig_line,
                commit_id: current_sha.clone(),
                content: content.to_string(),
            });

            cur_previous = None;
        } else if let Some(author) = line.strip_prefix("author ") {
            cur_author = author.trim().to_string();
        } else if let Some(mail) = line.strip_prefix("author-mail ") {
            cur_author_mail = mail.trim_matches(['<', '>', ' ']).to_string();
        } else if let Some(time) = line.strip_prefix("author-time ") {
            cur_author_time = time.trim().parse::<i64>().unwrap_or(0);
        } else if let Some(tz) = line.strip_prefix("author-tz ") {
            cur_author_tz = tz.trim().to_string();
        } else if let Some(committer) = line.strip_prefix("committer ") {
            cur_committer = committer.trim().to_string();
        } else if let Some(mail) = line.strip_prefix("committer-mail ") {
            cur_committer_mail = mail.trim_matches(['<', '>', ' ']).to_string();
        } else if let Some(time) = line.strip_prefix("committer-time ") {
            cur_committer_time = time.trim().parse::<i64>().unwrap_or(0);
        } else if let Some(summary) = line.strip_prefix("summary ") {
            cur_summary = summary.trim().to_string();
        } else if let Some(prev) = line.strip_prefix("previous ") {
            let parts: Vec<&str> = prev.split_whitespace().collect();
            if let Some(prev_sha) = parts.first() {
                cur_previous = Some(prev_sha.to_string());
            }
        } else {
            // Header: <sha> <orig_line> <final_line> ...
            let tokens: Vec<&str> = line.split_whitespace().collect();
            if tokens.len() >= 3
                && tokens[0].len() == 40
                && tokens[0].chars().all(|c| c.is_ascii_hexdigit())
            {
                current_sha = tokens[0].to_string();
                current_orig_line = tokens[1].parse::<usize>().unwrap_or(0);
                current_final_line = tokens[2].parse::<usize>().unwrap_or(0);
            }
        }
    }

    let total_lines = lines.len();

    // Calculate author stats
    let mut author_counts: HashMap<(String, String), usize> = HashMap::new();
    for l in &lines {
        if let Some(c) = commits.get(&l.commit_id) {
            let key = (c.author.clone(), c.author_mail.clone());
            *author_counts.entry(key).or_insert(0) += 1;
        }
    }

    let mut author_stats: Vec<BlameAuthorStat> = author_counts
        .into_iter()
        .map(|((name, email), count)| {
            let percentage = if total_lines > 0 {
                (count as f32 / total_lines as f32) * 100.0
            } else {
                0.0
            };
            BlameAuthorStat {
                name,
                email,
                line_count: count,
                percentage: (percentage * 10.0).round() / 10.0,
            }
        })
        .collect();

    author_stats.sort_by(|a, b| b.line_count.cmp(&a.line_count));

    FileBlamePayload {
        file_path: file_path.to_string(),
        revision: revision.to_string(),
        commits,
        lines,
        author_stats,
        total_lines,
        current_user_name: None,
        current_user_email: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_blame_porcelain() {
        let sample = "f73c4a735009aea92f8a4d5f3efa61b89087c4d8 1 1 2\n\
author Alice Bob\n\
author-mail <alice@example.com>\n\
author-time 1790594305\n\
author-tz +0700\n\
committer Alice Bob\n\
committer-mail <alice@example.com>\n\
committer-time 1790594305\n\
committer-tz +0700\n\
summary Initial commit\n\
filename sample.rs\n\
\tfn main() {\n\
f73c4a735009aea92f8a4d5f3efa61b89087c4d8 2 2\n\
author Alice Bob\n\
author-mail <alice@example.com>\n\
author-time 1790594305\n\
author-tz +0700\n\
committer Alice Bob\n\
committer-mail <alice@example.com>\n\
committer-time 1790594305\n\
committer-tz +0700\n\
summary Initial commit\n\
filename sample.rs\n\
\t}\n";

        let result = parse_blame_porcelain(sample, "sample.rs", "HEAD");
        assert_eq!(result.total_lines, 2);
        assert_eq!(result.lines.len(), 2);
        assert_eq!(result.lines[0].content, "fn main() {");
        assert_eq!(result.lines[1].content, "}");
        assert_eq!(result.commits.len(), 1);
        let commit = result
            .commits
            .get("f73c4a735009aea92f8a4d5f3efa61b89087c4d8")
            .unwrap();
        assert_eq!(commit.author, "Alice Bob");
        assert_eq!(commit.author_mail, "alice@example.com");
        assert_eq!(commit.summary, "Initial commit");
        assert_eq!(result.author_stats.len(), 1);
        assert_eq!(result.author_stats[0].line_count, 2);
        assert_eq!(result.author_stats[0].percentage, 100.0);
    }
}
