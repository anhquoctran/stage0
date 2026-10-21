use super::discovery::run_git_discovery_command;
use super::helper_credential_lookup::HelperCredentialLookup;
use std::{
    process::Command,
    time::{Duration, Instant},
};
use zeroize::Zeroize;

pub(super) fn system_or_global_helpers(
    git_bin: &str,
    repo_path: &str,
    remote_url: &str,
    deadline: Instant,
) -> Result<Vec<String>, ()> {
    let mut helpers = Vec::new();
    for scope in ["--system", "--global"] {
        if Instant::now() >= deadline {
            return Err(());
        }
        let result = run_git_discovery_command(
            git_bin,
            repo_path,
            &[
                "config",
                scope,
                "--null",
                "--get-urlmatch",
                "credential.helper",
                remote_url,
            ],
            Duration::from_secs(2),
        )?;
        if !result.status.success() {
            // `git config --get-urlmatch` exits 1 when no helper matches.
            if result.status.code() == Some(1) && result.stdout.is_empty() {
                continue;
            }
            return Err(());
        }
        if result.output_truncated {
            return Err(());
        }
        let mut helper_values = result
            .stdout
            .split(|byte| *byte == b'\0')
            .collect::<Vec<_>>();
        if result.stdout.last() == Some(&b'\0') {
            helper_values.pop();
        }
        for helper in helper_values {
            let Ok(helper) = std::str::from_utf8(helper) else {
                return Err(());
            };
            if helper.is_empty() {
                helpers.clear();
            } else {
                helpers.push(helper.to_string());
            }
        }
    }
    Ok(helpers)
}

pub(super) fn read_helper_credential(
    git_bin: &str,
    remote_url: &str,
    helpers: &[String],
) -> HelperCredentialLookup {
    let mut command = Command::new(git_bin);
    command
        // Run outside the repository so local `.git/config` credential
        // settings and helpers cannot participate in this system/global scan.
        .current_dir(std::env::temp_dir())
        .args(["-c", "credential.helper="])
        .args(
            helpers
                .iter()
                .flat_map(|helper| ["-c".to_string(), format!("credential.helper={helper}")]),
        )
        .args(["-c", "credential.trace=false"])
        .args(["-c", "credential.traceSecrets=false"])
        .args(["credential", "fill"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "0")
        .env("GCM_GUI_PROMPT", "0")
        .env_remove("GIT_TRACE")
        .env_remove("GIT_TRACE_CURL")
        .env_remove("GIT_CURL_VERBOSE")
        .env_remove("GCM_TRACE");

    let input = format!("url={remote_url}\n\n").into_bytes();
    let Ok(mut output) = crate::common::process::run_bounded_command_with_input(
        &mut command,
        input,
        64 * 1024,
        16 * 1024,
        Duration::from_secs(5),
    ) else {
        return HelperCredentialLookup {
            username: None,
            complete: false,
        };
    };

    let mut username = None;
    let mut has_password = false;
    if !output.output_truncated {
        for line in output.stdout.split(|byte| *byte == b'\n') {
            let line = line.strip_suffix(b"\r").unwrap_or(line);
            if let Some(value) = line.strip_prefix(b"username=") {
                if !value.is_empty() {
                    username = std::str::from_utf8(value).ok().map(str::to_string);
                }
            } else if let Some(value) = line.strip_prefix(b"password=") {
                has_password = !value.is_empty();
            }
        }
    }

    output.stdout.zeroize();
    output.stderr.zeroize();
    HelperCredentialLookup {
        username: if has_password {
            username.filter(|value| !value.trim().is_empty())
        } else {
            None
        },
        complete: !output.output_truncated,
    }
}
