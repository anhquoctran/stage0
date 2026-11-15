use crate::features::git::runner::get_active_git_path;
use crate::features::review::context::git;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

/// Git resolves all requested names in one bounded process, including missing
/// refs, SHA/revision expressions and remote fallbacks. No source blobs are read.
pub(super) fn inventory(
    root: &str,
    names: &HashSet<String>,
) -> Result<HashMap<String, Option<String>>, String> {
    let mut candidates = HashMap::new();
    for name in names {
        let reference = name.trim();
        let mut choices = Vec::new();
        if !reference.is_empty()
            && !reference.starts_with('-')
            && !reference
                .chars()
                .any(|c| c.is_control() || c.is_whitespace())
        {
            choices.push(format!("{reference}^{{commit}}"));
            if !reference.starts_with("origin/") && !reference.starts_with("refs/") {
                choices.push(format!("origin/{reference}^{{commit}}"));
                choices.push(format!("remotes/origin/{reference}^{{commit}}"));
            }
            if let Some(local) = reference.strip_prefix("origin/") {
                choices.push(format!("{local}^{{commit}}"));
            }
        }
        candidates.insert(name.clone(), choices);
    }
    let mut resolved = names
        .iter()
        .map(|n| (n.clone(), None))
        .collect::<HashMap<_, _>>();
    for round in 0..3 {
        let requests = candidates
            .iter()
            .filter(|(name, choices)| resolved[*name].is_none() && choices.get(round).is_some())
            .map(|(name, choices)| (name.clone(), choices[round].clone()))
            .collect::<Vec<_>>();
        if requests.is_empty() {
            break;
        }
        let queries = requests.iter().map(|(_, q)| q.clone()).collect::<Vec<_>>();
        let answers = batch(root, &queries)?;
        for ((name, _), value) in requests.into_iter().zip(answers) {
            if value.is_some() {
                resolved.insert(name, value);
            }
        }
    }
    Ok(resolved)
}

fn batch(root: &str, queries: &[String]) -> Result<Vec<Option<String>>, String> {
    let input = format!("{}\n", queries.join("\n")).into_bytes();
    if input.len() > 2 * 1024 * 1024 {
        return Err("MR ref query exceeds the bounded metadata limit".into());
    }
    let mut command = Command::new(get_active_git_path());
    command
        .current_dir(root)
        .args([
            "--no-pager",
            "--no-replace-objects",
            "--no-optional-locks",
            "-c",
            "core.fsmonitor=false",
            "cat-file",
            "--batch-check=%(objectname) %(objecttype)",
        ])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_ALLOW_PROTOCOL", "");
    let output = crate::common::process::run_bounded_command_with_input(
        &mut command,
        input,
        8 * 1024 * 1024,
        16 * 1024,
        Duration::from_secs(15),
    )?;
    if !output.status.success() || output.output_truncated {
        return Err("Could not read bounded local Git refs".into());
    }
    let text = String::from_utf8(output.stdout).map_err(|_| "Invalid Git ref response")?;
    let rows = text
        .lines()
        .map(|line| {
            let fields = line.split_whitespace().collect::<Vec<_>>();
            (fields.len() == 2
                && fields[1] == "commit"
                && [40, 64].contains(&fields[0].len())
                && fields[0].bytes().all(|b| b.is_ascii_hexdigit()))
            .then(|| fields[0].to_owned())
        })
        .collect::<Vec<_>>();
    if rows.len() != queries.len() {
        return Err("Incomplete Git ref batch".into());
    }
    Ok(rows)
}

pub(super) fn watch_paths(root: &str) -> Result<Vec<PathBuf>, String> {
    let git_dir = git(root, &["rev-parse", "--absolute-git-dir"], 16 * 1024)?;
    let common = git(
        root,
        &["rev-parse", "--path-format=absolute", "--git-common-dir"],
        16 * 1024,
    )?;
    let mut paths = vec![PathBuf::from(git_dir.trim()), PathBuf::from(common.trim())];
    paths.sort();
    paths.dedup();
    Ok(paths)
}

pub(super) fn relevant(path: &std::path::Path, roots: &[PathBuf]) -> bool {
    roots.iter().any(|root| {
        path == root
            || path.strip_prefix(root).ok().is_some_and(|p| {
                let name = p.to_string_lossy().replace('\\', "/");
                name == "HEAD"
                    || name == "packed-refs"
                    || name == "refs"
                    || name.starts_with("refs/")
                    || name == "reftable"
                    || name.starts_with("reftable/")
            })
    }) && !path.to_string_lossy().ends_with(".lock")
}
