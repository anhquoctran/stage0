use std::{process::Command, time::Duration};

pub(super) fn merge_decoded(
    old: &str,
    ancestor: &str,
    new: &str,
    old_label: &str,
    new_label: &str,
) -> Result<String, String> {
    let directory = tempfile::tempdir().map_err(|_| "Could not create text merge preview")?;
    for (name, text) in [("old", old), ("ancestor", ancestor), ("new", new)] {
        std::fs::write(directory.path().join(name), text)
            .map_err(|_| "Could not prepare text merge preview")?;
    }
    let mut command = Command::new(super::runner::get_active_git_path());
    command
        .current_dir(directory.path())
        .args([
            "--no-pager",
            "merge-file",
            "-p",
            "-L",
            old_label,
            "-L",
            "ancestor",
            "-L",
            new_label,
            "--",
            "old",
            "ancestor",
            "new",
        ])
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        );
    let result = crate::common::process::run_bounded_command(
        &mut command,
        16 * 1024 * 1024,
        16 * 1024,
        Duration::from_secs(15),
    )?;
    if result.output_truncated || !matches!(result.status.code(), Some(0..=127)) {
        return Err("Could not compute bounded decoded merge preview".into());
    }
    String::from_utf8(result.stdout).map_err(|_| "Invalid decoded merge output".into())
}
