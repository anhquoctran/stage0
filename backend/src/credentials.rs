use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use zeroize::Zeroize;

pub const KEYRING_SERVICE: &str = "stage0.git.credentials";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OsKeyringInfo {
    pub os: String,
    pub keyring_name: String,
    pub is_available: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitCredentialMeta {
    pub id: String,
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_ref: String,
    pub token_type: String,
    pub label: Option<String>,
    pub source: String,
    pub helper_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_in_keyring: bool,
}

pub struct SystemGitCredentialDiscovery {
    pub credentials: Vec<GitCredentialMeta>,
    pub complete: bool,
}

#[derive(Default)]
pub struct GitCredentialScanCoordinator(Mutex<GitCredentialScanState>);

#[derive(Default)]
struct GitCredentialScanState {
    running: bool,
    requested_again: bool,
}

/// Schedules a background refresh and coalesces repeated requests while a scan
/// is running. A later request triggers one more pass with the latest repo list.
pub fn schedule_system_git_credential_rescan(app: &AppHandle) {
    let Some(coordinator) = app.try_state::<GitCredentialScanCoordinator>() else {
        return;
    };
    let start_scan = match coordinator.0.lock() {
        Ok(mut state) if state.running => {
            state.requested_again = true;
            false
        }
        Ok(mut state) => {
            state.running = true;
            true
        }
        Err(poisoned) => {
            let mut state = poisoned.into_inner();
            if state.running {
                state.requested_again = true;
                false
            } else {
                state.running = true;
                true
            }
        }
    };
    if !start_scan {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || loop {
        let scan_result = (|| {
            let db = app.state::<crate::db::Database>();
            let repo_paths = db.get_all_repository_paths().ok()?;
            let discovery = discover_system_git_credentials(&repo_paths);
            db.sync_system_git_credentials(&discovery.credentials, discovery.complete)
                .ok()?;
            Some(())
        })();
        if scan_result.is_some() {
            let _ = app.emit("git-credentials-updated", ());
        }

        let Some(coordinator) = app.try_state::<GitCredentialScanCoordinator>() else {
            break;
        };
        let run_again = match coordinator.0.lock() {
            Ok(mut state) => {
                if state.requested_again {
                    state.requested_again = false;
                    true
                } else {
                    state.running = false;
                    false
                }
            }
            Err(poisoned) => {
                let mut state = poisoned.into_inner();
                if state.requested_again {
                    state.requested_again = false;
                    true
                } else {
                    state.running = false;
                    false
                }
            }
        };
        if !run_again {
            break;
        }
    });
}

#[derive(Deserialize, Clone, Debug)]
pub struct SaveGitCredentialPayload {
    pub provider: String,
    pub server_url: String,
    pub account_name: String,
    pub token_type: String,
    pub label: Option<String>,
    pub secret: String,
}

/// Finds credentials already available to Git for remotes in repositories
/// Stage0 has recorded. Only metadata is returned; helper passwords are
/// discarded from memory and never written to the Stage0 database.
pub fn discover_system_git_credentials(repo_paths: &[String]) -> SystemGitCredentialDiscovery {
    let git_bin = crate::git::runner::get_active_git_path();
    let mut discovered = HashMap::<String, GitCredentialMeta>::new();
    let mut scanned_remotes = HashSet::new();
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut complete = true;

    for repo_path in repo_paths {
        if Instant::now() >= deadline {
            complete = false;
            break;
        }
        let remotes = match list_repository_remotes(&git_bin, repo_path) {
            Ok(remotes) => remotes,
            Err(()) => {
                complete = false;
                continue;
            }
        };

        for remote_name in remotes {
            if Instant::now() >= deadline {
                complete = false;
                break;
            }
            let remote_urls = match list_remote_urls(&git_bin, repo_path, &remote_name) {
                Ok(urls) => urls,
                Err(()) => {
                    complete = false;
                    continue;
                }
            };

            for remote_url in remote_urls.iter().map(String::as_str) {
                if !remote_url
                    .get(..8)
                    .is_some_and(|scheme| scheme.eq_ignore_ascii_case("https://"))
                {
                    continue;
                }
                if crate::git::ops::validate_remote_url(remote_url).is_err() {
                    continue;
                }
                let remote_identity = canonical_remote_identity(remote_url);
                if !scanned_remotes.insert(remote_identity.clone()) {
                    continue;
                }

                let helpers =
                    match system_or_global_helpers(&git_bin, repo_path, remote_url, deadline) {
                        Ok(helpers) => helpers,
                        Err(()) => {
                            complete = false;
                            continue;
                        }
                    };
                if helpers.is_empty() {
                    continue;
                }
                let lookup = read_helper_credential(&git_bin, remote_url, &helpers);
                if !lookup.complete {
                    complete = false;
                }
                let Some(username) = lookup.username else {
                    continue;
                };
                let token_ref = tokenized_helper_ref(&remote_identity, &username);
                let provider = provider_for_remote(remote_url);
                let now = chrono::Utc::now().to_rfc3339();
                discovered.insert(
                    token_ref.clone(),
                    GitCredentialMeta {
                        id: token_ref.clone(),
                        provider,
                        server_url: remote_url.to_string(),
                        account_name: username,
                        token_ref,
                        token_type: "managed".to_string(),
                        label: Some("System / global Git credential".to_string()),
                        source: "system_global".to_string(),
                        helper_name: Some("Git credential helper".to_string()),
                        created_at: now.clone(),
                        updated_at: now,
                        is_in_keyring: true,
                    },
                );
            }
        }
    }

    let mut credentials = discovered.into_values().collect::<Vec<_>>();
    credentials.sort_by(|left, right| left.token_ref.cmp(&right.token_ref));
    SystemGitCredentialDiscovery {
        credentials,
        complete,
    }
}

fn list_repository_remotes(git_bin: &str, repo_path: &str) -> Result<Vec<String>, ()> {
    let result =
        run_git_discovery_command(git_bin, repo_path, &["remote"], Duration::from_secs(2))?;
    if !result.status.success() || result.output_truncated {
        return Err(());
    }
    Ok(result
        .stdout
        .split(|byte| *byte == b'\n')
        .filter_map(|line| std::str::from_utf8(line).ok())
        .map(str::trim)
        .filter(|remote| !remote.is_empty())
        .map(str::to_string)
        .collect())
}

fn list_remote_urls(git_bin: &str, repo_path: &str, remote: &str) -> Result<Vec<String>, ()> {
    let result = run_git_discovery_command(
        git_bin,
        repo_path,
        &["remote", "get-url", "--all", remote],
        Duration::from_secs(2),
    )?;
    if !result.status.success() || result.output_truncated {
        return Err(());
    }
    let mut stdout = result.stdout;
    let mut stderr = result.stderr;
    let mut urls = Vec::new();
    for line in stdout.split(|byte| *byte == b'\n') {
        let Ok(line) = std::str::from_utf8(line) else {
            continue;
        };
        let mut url = line.trim().to_string();
        if url.starts_with("https://") && crate::git::ops::validate_remote_url(&url).is_ok() {
            urls.push(url);
        } else {
            url.zeroize();
        }
    }
    stdout.zeroize();
    stderr.zeroize();
    Ok(urls)
}

fn run_git_discovery_command(
    git_bin: &str,
    repo_path: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<crate::process::BoundedOutput, ()> {
    let mut command = Command::new(git_bin);
    command
        .current_dir(repo_path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env_remove("GIT_TRACE")
        .env_remove("GIT_TRACE_CURL")
        .env_remove("GIT_CURL_VERBOSE")
        .env_remove("GCM_TRACE");
    crate::process::run_bounded_command(&mut command, 256 * 1024, 64 * 1024, timeout)
        .map_err(|_| ())
}

fn system_or_global_helpers(
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

struct HelperCredentialLookup {
    username: Option<String>,
    complete: bool,
}

fn read_helper_credential(
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
    let Ok(mut output) = crate::process::run_bounded_command_with_input(
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

    let git_bin = crate::git::runner::get_active_git_path();
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
    let output = crate::process::run_bounded_command_with_input(
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

pub(crate) fn https_origin(value: &str) -> Result<String, String> {
    crate::git::ops::validate_remote_url(value)?;
    let parsed = reqwest::Url::parse(value).map_err(|_| {
        "Git credential selection requires a valid HTTPS repository URL.".to_string()
    })?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Git credentials can only be used with HTTPS repository URLs without embedded credentials.".to_string());
    }
    Ok(parsed.origin().ascii_serialization())
}

fn contains_protocol_control(value: &str) -> bool {
    value
        .bytes()
        .any(|byte| byte == b'\n' || byte == b'\r' || byte == 0)
}

fn tokenized_helper_ref(remote_url: &str, username: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(remote_url.as_bytes());
    digest.update([0]);
    digest.update(username.as_bytes());
    let bytes = digest.finalize();
    let suffix = bytes[..16]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("sys_git_{suffix}")
}

fn canonical_remote_identity(remote_url: &str) -> String {
    let Some((scheme, remainder)) = remote_url.split_once("://") else {
        return remote_url.to_string();
    };
    let (authority, path) = remainder.split_once('/').unwrap_or((remainder, ""));
    format!(
        "{}://{}{}",
        scheme.to_ascii_lowercase(),
        authority.to_ascii_lowercase(),
        if path.is_empty() {
            String::new()
        } else {
            format!("/{path}")
        }
    )
}

fn provider_for_remote(remote_url: &str) -> String {
    let host = remote_url
        .split_once("://")
        .map(|(_, remainder)| remainder)
        .and_then(|remainder| remainder.split('/').next())
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    if host == "github.com" {
        "github"
    } else if host == "gitlab.com" {
        "gitlab"
    } else if host == "bitbucket.org" {
        "bitbucket"
    } else if host == "dev.azure.com" || host.ends_with(".visualstudio.com") {
        "azure_devops"
    } else {
        "custom"
    }
    .to_string()
}

fn map_keyring_error(action: &str, err: keyring::Error) -> String {
    match err {
        keyring::Error::NoStorageAccess(ref inner) => {
            #[cfg(target_os = "linux")]
            {
                format!("Cannot access secure credential vault: {}. Ensure a FreeDesktop Secret Service daemon (such as gnome-keyring or ksecretservice) is installed, unlocked, and running.", inner)
            }
            #[cfg(target_os = "macos")]
            {
                format!("macOS Keychain access error: {}. Ensure Keychain is unlocked and permission is granted.", inner)
            }
            #[cfg(target_os = "windows")]
            {
                format!("Windows Credential Manager access error: {}.", inner)
            }
            #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
            {
                format!("Cannot access OS credential store: {}.", inner)
            }
        }
        keyring::Error::PlatformFailure(ref inner) => {
            format!(
                "OS Credential Manager platform error while attempting to {}: {}",
                action, inner
            )
        }
        keyring::Error::NoEntry => {
            format!(
                "No matching credential entry found while attempting to {}.",
                action
            )
        }
        other => format!("Failed to {} in OS Credential Manager: {}", action, other),
    }
}

pub fn get_os_keyring_info() -> OsKeyringInfo {
    #[cfg(target_os = "windows")]
    {
        OsKeyringInfo {
            os: "windows".to_string(),
            keyring_name: "Windows Credential Manager".to_string(),
            is_available: true,
        }
    }
    #[cfg(target_os = "macos")]
    {
        OsKeyringInfo {
            os: "macos".to_string(),
            keyring_name: "macOS Keychain".to_string(),
            is_available: true,
        }
    }
    #[cfg(target_os = "linux")]
    {
        OsKeyringInfo {
            os: "linux".to_string(),
            keyring_name: "Secret Service (GNOME Keyring / KWallet)".to_string(),
            is_available: true,
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        OsKeyringInfo {
            os: "unknown".to_string(),
            keyring_name: "OS Credential Manager".to_string(),
            is_available: true,
        }
    }
}

pub fn store_secret(token_ref: &str, secret: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    entry
        .set_password(secret)
        .map_err(|e| map_keyring_error("store secret", e))?;
    Ok(())
}

pub fn retrieve_secret(token_ref: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    entry
        .get_password()
        .map_err(|e| map_keyring_error("retrieve secret", e))
}

pub fn delete_secret(token_ref: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, token_ref)
        .map_err(|e| map_keyring_error("initialize", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(map_keyring_error("delete secret", error)),
    }
}

pub fn exists_in_keyring(token_ref: &str) -> bool {
    match keyring::Entry::new(KEYRING_SERVICE, token_ref) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

pub const AI_KEYRING_SERVICE: &str = "stage0.ai.credentials";

pub fn store_ai_key(provider: &str, api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    entry
        .set_password(api_key)
        .map_err(|e| map_keyring_error("store AI secret", e))?;
    Ok(())
}

pub fn ai_key_exists(provider: &str) -> Result<bool, String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(map_keyring_error("check AI secret", error)),
    }
}

pub fn delete_ai_key(provider: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(map_keyring_error("delete AI secret", error)),
    }
}

pub fn get_ai_key(provider: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(AI_KEYRING_SERVICE, provider)
        .map_err(|e| map_keyring_error("initialize AI secret", e))?;
    entry
        .get_password()
        .map_err(|e| map_keyring_error("read AI secret", e))
}
