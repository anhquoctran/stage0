use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliHarnessReadiness {
    pub cli_type: String,
    pub executable_path: Option<String>,
    pub executable_found: bool,
    pub attached_to_harness: bool,
    pub required_protocol: String,
    pub message: String,
}

pub fn inspect(cli_type: &str) -> Result<CliHarnessReadiness, String> {
    let program = match cli_type {
        "claude" => "claude",
        "gh_copilot" => "gh",
        "gcloud" => "gcloud",
        "grok" | "xai_grok" => "grok",
        _ => return Err("Unsupported CLI type for harness preflight".into()),
    };
    let path = std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths).find_map(|dir| {
            // No shell, --version invocation, auth-file read or package installation.
            #[cfg(windows)]
            let candidates = vec![
                dir.join(format!("{program}.exe")),
                dir.join(format!("{program}.cmd")),
                dir.join(format!("{program}.bat")),
            ];
            #[cfg(not(windows))]
            let candidates = vec![dir.join(program)];
            candidates.into_iter().find(is_executable)
        })
    });
    Ok(CliHarnessReadiness{cli_type:cli_type.into(),executable_found:path.is_some(),executable_path:path.map(|p|p.to_string_lossy().into_owned()),attached_to_harness:false,required_protocol:super::cli_protocol::VERSION.into(),message:"Filesystem preflight only; no process or authentication probe was run. CLI presence/login is not a tool-calling capability. A reviewed structured-protocol adapter and OS-level isolation/approval policy are required before attaching this CLI; the legacy prompt runner is not used by the harness.".into()})
}

fn is_executable(path: &PathBuf) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn cli_preflight_never_claims_authentication_or_harness_attachment() {
        for cli in ["claude", "gh_copilot", "gcloud", "grok"] {
            let report = super::inspect(cli).unwrap();
            assert!(!report.attached_to_harness);
            assert_eq!(
                report.required_protocol,
                super::super::cli_protocol::VERSION
            );
        }
        assert!(super::inspect("claude --dangerously-skip-permissions").is_err());
    }
}
