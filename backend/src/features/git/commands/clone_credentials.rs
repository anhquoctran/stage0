use super::clone_credential_lease::CloneCredentialLease;
use crate::core::db::Database;
use zeroize::Zeroizing;

pub(super) fn prepare_clone_credential(
    db: &Database,
    credential_id: &str,
    remote_url: &str,
) -> Result<CloneCredentialLease, String> {
    let target_origin = crate::features::credentials::https_origin(remote_url)?;
    let credential = db
        .get_git_credential_metadata(credential_id)
        .map_err(|_| crate::common::messages::code("backend.credentials.loadFailed"))?
        .ok_or_else(|| crate::common::messages::code("backend.credentials.notFound"))?;
    let token_ref = db
        .get_git_credential_token_ref(credential_id)
        .map_err(|_| crate::common::messages::code("backend.credentials.loadFailed"))?
        .ok_or_else(|| crate::common::messages::code("backend.credentials.loadFailed"))?;

    if credential.token_type == "ssh_key" {
        return Err(crate::common::messages::code(
            "backend.git.httpsCredentialRequired",
        ));
    }
    let credential_origin = crate::features::credentials::https_origin(&credential.server_url)?;
    if credential_origin != target_origin {
        return Err(crate::common::messages::code(
            "backend.git.credentialHostMismatch",
        ));
    }
    if credential.account_name.trim().is_empty()
        || credential
            .account_name
            .bytes()
            .any(|byte| byte == b'\n' || byte == b'\r' || byte == 0)
    {
        return Err(crate::common::messages::code(
            "backend.git.credentialAccountInvalid",
        ));
    }

    let (token_ref, delete_secret_on_drop) = match credential.source.as_str() {
        "stage0" => {
            let secret =
                crate::features::credentials::retrieve_secret(&token_ref).map_err(|_| {
                    crate::common::messages::code("backend.git.credentialSecretMissing")
                })?;
            drop(Zeroizing::new(secret));
            (token_ref, false)
        }
        "system_global" => {
            let secret = crate::features::credentials::retrieve_system_global_credential_for_clone(
                remote_url,
                &credential.account_name,
            )?;
            let token_ref = format!("st0_clone_{}", uuid::Uuid::new_v4().simple());
            crate::features::credentials::store_secret(&token_ref, secret.as_str())?;
            (token_ref, true)
        }
        _ => {
            return Err(crate::common::messages::code(
                "backend.git.credentialSourceUnsupported",
            ));
        }
    };

    Ok(CloneCredentialLease {
        token_ref,
        expected_origin: target_origin,
        username: credential.account_name,
        delete_secret_on_drop,
    })
}

pub(super) fn clone_credential_helper_config(
    credential: &CloneCredentialLease,
) -> Result<String, String> {
    let executable = std::env::current_exe()
        .map_err(|error| {
            crate::common::messages::failure(
                "backend.git.executableLocateFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Could not locate the Stage0 executable: {error}"),
            )
        })?
        .to_string_lossy()
        .replace('\\', "/");
    Ok(format!(
        "!{} --stage0-git-credential-helper {} {} {}",
        git_shell_quote(&executable),
        git_shell_quote(&credential.token_ref),
        git_shell_quote(&credential.expected_origin),
        git_shell_quote(&credential.username),
    ))
}

pub(super) fn apply_clone_credential_helper(
    command: &mut std::process::Command,
    origin: &str,
    helper: &str,
) {
    // Reset helpers only for the selected HTTPS origin. Other-host submodules
    // retain their existing credential setup; the selected secret never leaks
    // to those hosts and is never written into a cloned repository's config.
    command.args(["-c", &format!("credential.{origin}.helper=")]);
    command.args(["-c", &format!("credential.{origin}.helper={helper}")]);
}

#[cfg(test)]
mod clone_credentials_tests {
    #[test]
    fn selected_clone_helper_is_origin_scoped_and_preserves_other_host_helpers() {
        for (origin, expected) in [
            ("https://primary.example.test", "selected-fixture"),
            ("https://submodule.example.test", "existing-fixture"),
        ] {
            let mut command = std::process::Command::new("git");
            command.args(["-c", "credential.helper="]);
            command.args(["-c", "credential.helper=!f() { printf 'username=fixture\\npassword=existing-fixture\\n'; }; f"]);
            super::apply_clone_credential_helper(
                &mut command,
                "https://primary.example.test",
                "!f() { printf 'username=fixture\\npassword=selected-fixture\\n'; }; f",
            );
            command
                .args(["credential", "fill"])
                .env("GIT_TERMINAL_PROMPT", "0");
            let output = crate::common::process::run_bounded_command_with_input(
                &mut command,
                format!("url={origin}/repo.git\n\n").into_bytes(),
                4096,
                4096,
                std::time::Duration::from_secs(5),
            )
            .unwrap();
            assert!(output.status.success());
            assert!(
                String::from_utf8_lossy(&output.stdout).contains(&format!("password={expected}"))
            );
        }
    }
}

fn git_shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
