use super::{
    helper_lookup::system_or_global_helpers,
    remote_identity::{contains_protocol_control, https_origin},
    retrieve_secret,
};
use std::{
    io::{Read, Write},
    process::Command,
    time::{Duration, Instant},
};
use zeroize::Zeroize;

/// Resolve a selected system/global credential for a one-time HTTPS clone.
/// The returned password is held in a zeroizing wrapper by the caller.
pub(crate) fn retrieve_system_global_credential_for_clone(
    remote_url: &str,
    expected_username: &str,
) -> Result<zeroize::Zeroizing<String>, String> {
    https_origin(remote_url)?;
    if expected_username.trim().is_empty() || contains_protocol_control(expected_username) {
        return Err("The selected Git credential has an invalid account name.".to_string());
    }

    let git_bin = crate::features::git::runner::get_active_git_path();
    let temp_dir = std::env::temp_dir();
    let temp_dir = temp_dir.to_string_lossy().to_string();
    let helpers = system_or_global_helpers(
        &git_bin,
        &temp_dir,
        remote_url,
        Instant::now() + Duration::from_secs(5),
    )
    .map_err(|_| {
        "Could not read the system/global Git credential helper configuration.".to_string()
    })?;
    if helpers.is_empty() {
        return Err(
            "No system/global Git credential helper is configured for this HTTPS host.".to_string(),
        );
    }

    let mut command = Command::new(&git_bin);
    command
        .current_dir(&temp_dir)
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

    let mut input = format!("url={remote_url}\nusername={expected_username}\n\n").into_bytes();
    let output = crate::common::process::run_bounded_command_with_input(
        &mut command,
        std::mem::take(&mut input),
        64 * 1024,
        16 * 1024,
        Duration::from_secs(5),
    );
    input.zeroize();

    let mut output = output.map_err(|_| {
        "The system/global Git credential helper did not return a credential in time.".to_string()
    })?;
    let mut username: Option<String> = None;
    let mut password: Option<String> = None;
    let mut unsupported_auth = false;
    if !output.output_truncated {
        for line in output.stdout.split(|byte| *byte == b'\n') {
            let line = line.strip_suffix(b"\r").unwrap_or(line);
            if let Some(value) = line.strip_prefix(b"username=") {
                username = std::str::from_utf8(value).ok().map(str::to_string);
            } else if let Some(value) = line.strip_prefix(b"password=") {
                password = std::str::from_utf8(value).ok().map(str::to_string);
            } else if line.starts_with(b"authtype=") || line.starts_with(b"credential=") {
                unsupported_auth = true;
            }
        }
    }
    output.stdout.zeroize();
    output.stderr.zeroize();

    if output.output_truncated || !output.status.success() {
        if let Some(mut password) = password {
            password.zeroize();
        }
        return Err(
            "The system/global Git credential helper could not provide the selected account."
                .to_string(),
        );
    }
    if unsupported_auth {
        if let Some(mut password) = password {
            password.zeroize();
        }
        return Err("This system credential uses an authentication format that Stage0 cannot apply to a one-time clone yet.".to_string());
    }

    let username = username.unwrap_or_default();
    if username != expected_username {
        if let Some(mut password) = password {
            password.zeroize();
        }
        return Err(
            "The system/global Git helper returned a different account than the one selected."
                .to_string(),
        );
    }
    let password = zeroize::Zeroizing::new(password.unwrap_or_default());
    if password.is_empty() || contains_protocol_control(&password) {
        return Err(
            "The selected system/global Git credential is not a password-based HTTPS credential."
                .to_string(),
        );
    }

    Ok(password)
}

/// Entry point used by the Git credential helper shim in the Stage0 binary.
/// Git appends `get`, `store`, or `erase` to the configured helper command.
pub fn run_git_credential_helper(
    token_ref: &str,
    expected_origin: &str,
    username: &str,
    operation: &str,
) -> i32 {
    if operation != "get" {
        // A clone-scoped credential must never be persisted back into any Git
        // helper or erased from the user's system credential store.
        return 0;
    }
    if token_ref.is_empty()
        || contains_protocol_control(token_ref)
        || contains_protocol_control(username)
    {
        return 1;
    }

    let mut input = Vec::new();
    let read_result = std::io::stdin().take(64 * 1024 + 1).read_to_end(&mut input);
    if read_result.is_err() || input.len() > 64 * 1024 {
        input.zeroize();
        return 1;
    }

    let mut protocol = None;
    let mut host = None;
    for line in input.split(|byte| *byte == b'\n') {
        let line = line.strip_suffix(b"\r").unwrap_or(line);
        if let Some(value) = line.strip_prefix(b"protocol=") {
            protocol = std::str::from_utf8(value).ok().map(str::to_string);
        } else if let Some(value) = line.strip_prefix(b"host=") {
            host = std::str::from_utf8(value).ok().map(str::to_string);
        }
    }
    input.zeroize();

    let Some(protocol) = protocol else {
        return 0;
    };
    let Some(host) = host else {
        return 0;
    };
    if !protocol.eq_ignore_ascii_case("https") {
        return 0;
    }
    let request_origin = format!("https://{host}");
    if https_origin(&request_origin).ok().as_deref() != Some(expected_origin) {
        return 0;
    }

    let mut secret = match retrieve_secret(token_ref) {
        Ok(secret) => secret,
        Err(_) => return 1,
    };
    if secret.is_empty() || contains_protocol_control(&secret) {
        secret.zeroize();
        return 1;
    }

    let stdout = std::io::stdout();
    let mut output = stdout.lock();
    let result = writeln!(output, "username={username}\npassword={secret}\n");
    secret.zeroize();
    if result.is_ok() {
        0
    } else {
        1
    }
}
