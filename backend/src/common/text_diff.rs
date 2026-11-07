//! Generate a display patch from decoded text; never rewrite repository bytes.
use super::git_path::quote as quote_path;
use std::process::Command;
use std::time::Duration;

pub fn file_header(old_path: &str, new_path: &str) -> String {
    format!(
        "diff --git {} {}",
        quote_path(&format!("a/{old_path}")),
        quote_path(&format!("b/{new_path}"))
    )
}

pub fn decoded_patch(
    git_binary: &str,
    old: Option<&str>,
    new: Option<&str>,
    old_path: &str,
    new_path: &str,
    cap: usize,
) -> Result<String, String> {
    let directory =
        tempfile::tempdir().map_err(|_| "Could not create bounded text diff workspace")?;
    let before = directory.path().join("before");
    let after = directory.path().join("after");
    std::fs::write(&before, old.unwrap_or_default())
        .map_err(|_| "Could not prepare decoded diff")?;
    std::fs::write(&after, new.unwrap_or_default())
        .map_err(|_| "Could not prepare decoded diff")?;
    let mut command = Command::new(git_binary);
    command
        .current_dir(directory.path())
        .args([
            "--no-pager",
            "-c",
            "core.fsmonitor=false",
            "diff",
            "--no-index",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--text",
            "-U3",
            "--",
            "before",
            "after",
        ])
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        );
    let result =
        super::process::run_bounded_command(&mut command, cap, 16 * 1024, Duration::from_secs(15))?;
    if result.output_truncated {
        return Err("Decoded patch exceeds the text diff safety limit".into());
    }
    if !matches!(result.status.code(), Some(0 | 1)) {
        return Err("Could not compute decoded text diff".into());
    }
    let patch = String::from_utf8(result.stdout).map_err(|_| "Invalid decoded diff output")?;
    let Some(offset) = patch.find("\n@@ ") else {
        return Ok(String::new());
    };
    let old_label = old
        .map(|_| quote_path(&format!("a/{old_path}")))
        .unwrap_or_else(|| "/dev/null".into());
    let new_label = new
        .map(|_| quote_path(&format!("b/{new_path}")))
        .unwrap_or_else(|| "/dev/null".into());
    let output = format!(
        "{}\n--- {old_label}\n+++ {new_label}{}",
        file_header(old_path, new_path),
        &patch[offset..]
    );
    if output.len() > cap {
        return Err("Decoded patch exceeds the text diff safety limit".into());
    }
    Ok(output)
}

/// Display transcoding must retain executable bits, additions/deletions and
/// original object identities even when decoded Unicode text is identical.
pub fn preserve_file_metadata(patch: &str, native: &str) -> String {
    if native.is_empty() {
        return patch.to_owned();
    }
    let metadata: Vec<_> = native
        .lines()
        .take_while(|line| {
            !line.starts_with("--- ")
                && !line.starts_with("@@ ")
                && !line.starts_with("Binary files ")
        })
        .filter(|line| {
            [
                "index ",
                "old mode ",
                "new mode ",
                "new file mode ",
                "deleted file mode ",
                "similarity index ",
                "dissimilarity index ",
                "rename from ",
                "rename to ",
                "copy from ",
                "copy to ",
            ]
            .iter()
            .any(|prefix| line.starts_with(prefix))
        })
        .collect();
    let (header, rest) = if patch.is_empty() {
        (native.lines().next().unwrap_or_default(), "")
    } else {
        patch.split_once('\n').unwrap_or((patch, ""))
    };
    let mut output = format!("{header}\n");
    for line in metadata {
        output.push_str(line);
        output.push('\n');
    }
    output.push_str(rest);
    if patch.is_empty() && (native.contains("\n--- ") || native.contains("\nBinary files ")) {
        output.push_str("[Decoded text unchanged; encoded file bytes changed.]\n");
    }
    output
}
