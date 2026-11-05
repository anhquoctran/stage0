//! Byte-oriented file reads. Git protocol metadata remains UTF-8 in runner.rs.
use std::{process::Command, time::Duration};

pub(super) fn read_blob_bytes(
    repo: &str,
    reference: &str,
    path: &str,
    cap: usize,
) -> Result<Vec<u8>, String> {
    let mut command = Command::new(super::runner::get_active_git_path());
    command
        .current_dir(repo)
        .args([
            "--no-pager",
            "--literal-pathspecs",
            "--no-replace-objects",
            "--no-optional-locks",
            "-c",
            "core.fsmonitor=false",
            "show",
            &format!("{reference}:{path}"),
        ])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_ALLOW_PROTOCOL", "");
    let output = crate::common::process::run_bounded_command(
        &mut command,
        cap,
        16 * 1024,
        Duration::from_secs(15),
    )?;
    if output.output_truncated {
        return Err("Text file exceeds the preview safety limit".into());
    }
    if !output.status.success() {
        return Err("Could not read the requested file snapshot".into());
    }
    Ok(output.stdout)
}
