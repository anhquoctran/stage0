use crate::common::{
    text_diff,
    text_encoding::{decode_buffer, DecodedText, TextEncoding},
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FileTextDiff {
    pub raw_diff: String,
    pub old_encoding: Option<String>,
    pub new_encoding: Option<String>,
    pub additions: u32,
    pub deletions: u32,
}

pub fn get_file_text_diff(
    repo: &str,
    old_ref: Option<&str>,
    new_ref: &str,
    path: &str,
    old_path: Option<&str>,
    encoding: Option<&str>,
) -> Result<FileTextDiff, String> {
    super::resolve_safe_repo_path(repo, path)?;
    let old_path = old_path.unwrap_or(path);
    super::resolve_safe_repo_path(repo, old_path)?;
    let new_sha = super::runner::resolve_ref(repo, new_ref)?.0;
    let old_sha = old_ref
        .map(|reference| super::runner::resolve_ref(repo, reference).map(|value| value.0))
        .transpose()?;
    let old = old_sha
        .as_deref()
        .map(|sha| read(repo, sha, old_path, encoding))
        .transpose()?
        .flatten();
    let new = read(repo, &new_sha, path, encoding)?;
    if old.is_none() && new.is_none() {
        return Err("File is missing from both selected snapshots".into());
    }
    let raw_diff = text_diff::decoded_patch(
        &super::runner::get_active_git_path(),
        old.as_ref().map(|blob| blob.text.as_str()),
        new.as_ref().map(|blob| blob.text.as_str()),
        old_path,
        path,
        5 * 1024 * 1024,
    )?;
    let mut args = vec!["--literal-pathspecs", "-c", "core.quotePath=false"];
    if old_sha.is_some() {
        args.push("diff");
    } else {
        args.extend(["diff-tree", "--root", "--no-commit-id", "-r"]);
    }
    args.extend([
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "--find-renames",
        "-p",
    ]);
    if let Some(sha) = old_sha.as_deref() {
        args.push(sha);
    }
    args.extend([&new_sha, "--", old_path, path]);
    // Only a bounded metadata prefix is needed; hunk contents come from the
    // explicitly decoded immutable blobs, never from this lossy protocol view.
    let mut command = std::process::Command::new(super::runner::get_active_git_path());
    command
        .current_dir(repo)
        .args([
            "--no-pager",
            "--no-replace-objects",
            "--no-optional-locks",
            "-c",
            "core.fsmonitor=false",
        ])
        .args(&args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_ALLOW_PROTOCOL", "");
    let native = crate::common::process::run_bounded_command(
        &mut command,
        8192,
        16 * 1024,
        std::time::Duration::from_secs(15),
    )?;
    if !native.status.success() && !native.output_truncated {
        return Err("Could not read file diff metadata".into());
    }
    let native = String::from_utf8_lossy(&native.stdout);
    let header = text_diff::file_header(old_path, path);
    let raw_diff = if native.lines().next() == Some(header.as_str()) {
        text_diff::preserve_file_metadata(&raw_diff, &native)
    } else {
        raw_diff
    };
    if raw_diff.len() > 5 * 1024 * 1024 {
        return Err("Decoded patch exceeds the text diff safety limit".into());
    }
    let lines: Vec<_> = raw_diff
        .lines()
        .skip_while(|line| !line.starts_with("@@ "))
        .collect();
    let additions = lines.iter().filter(|line| line.starts_with('+')).count() as u32;
    let deletions = lines.iter().filter(|line| line.starts_with('-')).count() as u32;
    Ok(FileTextDiff {
        raw_diff,
        additions,
        deletions,
        old_encoding: old.map(|blob| blob.guess.encoding.name().to_owned()),
        new_encoding: new.map(|blob| blob.guess.encoding.name().to_owned()),
    })
}

fn read(
    repo: &str,
    sha: &str,
    path: &str,
    encoding: Option<&str>,
) -> Result<Option<DecodedText>, String> {
    let encoding = encoding
        .map(|label| TextEncoding::for_label(label).ok_or("Unsupported text encoding"))
        .transpose()?;
    let entry = super::runner::run_git_strict(
        repo,
        &["--literal-pathspecs", "ls-tree", "-z", sha, "--", path],
    )?;
    if entry.is_empty() {
        return Ok(None);
    }
    if !(entry.starts_with("100644 blob ") || entry.starts_with("100755 blob ")) {
        return Err("Only regular files can be decoded as text".into());
    }
    let bytes = super::text_content::read_blob_bytes(repo, sha, path, 8 * 1024 * 1024)?;
    decode_buffer(&bytes, encoding).map(Some)
}
