use super::runner::run_git;
use super::ConflictReport;

pub fn check_conflicts(
    repo_path: &str,
    base: &str,
    compare: &str,
) -> Result<ConflictReport, String> {
    let res = run_git(repo_path, &["merge-tree", "--write-tree", base, compare])?;

    let combined = format!("{}
{}", res.stdout, res.stderr);
    let mut conflicted_files = Vec::new();

    let mut has_conflicts = !res.success || combined.contains("CONFLICT");

    for line in combined.lines() {
        let line = line.trim();
        if line.starts_with("CONFLICT") {
            has_conflicts = true;
            if let Some(idx) = line.find("Merge conflict in ") {
                let path = line[idx + "Merge conflict in ".len()..].trim();
                let clean_path = path.trim_matches(|c| c == '\'' || c == '"');
                if !clean_path.is_empty() && !conflicted_files.contains(&clean_path.to_string()) {
                    conflicted_files.push(clean_path.to_string());
                }
            } else if let Some(idx) = line.find("): ") {
                let rest = &line[idx + 3..];
                let words: Vec<&str> = rest.split_whitespace().collect();
                if let Some(first) = words.first() {
                    let clean_path = first.trim_matches(|c| c == '\'' || c == '"');
                    if !clean_path.is_empty() && !conflicted_files.contains(&clean_path.to_string()) {
                        conflicted_files.push(clean_path.to_string());
                    }
                }
            }
        }
    }

    Ok(ConflictReport {
        has_conflicts,
        conflicted_files,
    })
}
