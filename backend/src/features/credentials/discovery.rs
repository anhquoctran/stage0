use super::helper_lookup::{read_helper_credential, system_or_global_helpers};
use super::remote_identity::{
    canonical_remote_identity, provider_for_remote, tokenized_helper_ref,
};
use super::{GitCredentialMeta, SystemGitCredentialDiscovery};
use std::{
    collections::{HashMap, HashSet},
    process::Command,
    time::{Duration, Instant},
};
use zeroize::Zeroize;

/// Finds credentials available to Git for known repositories. Only non-secret
/// metadata is returned; helper passwords are discarded from memory.
pub fn discover_system_git_credentials(repo_paths: &[String]) -> SystemGitCredentialDiscovery {
    let git_bin = crate::features::git::runner::get_active_git_path();
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
                if crate::features::git::ops::validate_remote_url(remote_url).is_err() {
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
        if url.starts_with("https://")
            && crate::features::git::ops::validate_remote_url(&url).is_ok()
        {
            urls.push(url);
        } else {
            url.zeroize();
        }
    }
    stdout.zeroize();
    stderr.zeroize();
    Ok(urls)
}

pub(super) fn run_git_discovery_command(
    git_bin: &str,
    repo_path: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<crate::common::process::BoundedOutput, ()> {
    let mut command = Command::new(git_bin);
    command
        .current_dir(repo_path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env_remove("GIT_TRACE")
        .env_remove("GIT_TRACE_CURL")
        .env_remove("GIT_CURL_VERBOSE")
        .env_remove("GCM_TRACE");
    crate::common::process::run_bounded_command(&mut command, 256 * 1024, 64 * 1024, timeout)
        .map_err(|_| ())
}
