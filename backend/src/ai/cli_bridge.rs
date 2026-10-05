use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliDetectionResult {
    pub cli_type: String,
    pub available: bool,
    pub version: Option<String>,
    pub logged_in: bool,
    pub auth_info: Option<String>,
    pub executable_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliExecutionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub duration_ms: u64,
}

pub fn get_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

pub fn get_config_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(get_home_dir)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| get_home_dir().map(|h| h.join(".config")))
    }
}

/// Helper to configure a Command cross-platform (handling Windows .cmd/.bat wrappers)
fn make_cli_command(program: &str, args: &[&str]) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", program]);
        cmd.args(args);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new(program);
        cmd.args(args);
        cmd
    }
}

/// Find executable path using `where` on Windows or `which` on Unix
async fn locate_executable(name: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let check_cmd = Command::new("where").arg(name).output().await;

    #[cfg(not(target_os = "windows"))]
    let check_cmd = Command::new("which").arg(name).output().await;

    if let Ok(output) = check_cmd {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_line = stdout.lines().next().map(|s| s.trim().to_string());
            return first_line;
        }
    }
    None
}

/// Detect availability and auth status of a local CLI tool
pub async fn detect_cli(cli_type: &str) -> CliDetectionResult {
    match cli_type {
        "claude" => detect_claude_cli().await,
        "gh_copilot" => detect_gh_copilot_cli().await,
        "gcloud" => detect_gcloud_cli().await,
        other => CliDetectionResult {
            cli_type: other.to_string(),
            available: false,
            version: None,
            logged_in: false,
            auth_info: None,
            executable_path: None,
            error: Some(format!("Unknown CLI provider type '{}'", other)),
        },
    }
}

/// Detect Claude Code CLI (`claude`)
async fn detect_claude_cli() -> CliDetectionResult {
    let path = locate_executable("claude").await;
    let mut cmd = make_cli_command("claude", &["--version"]);
    let version_output = match tokio::time::timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(out)) if out.status.success() => {
            Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
        }
        _ => None,
    };

    if version_output.is_none() && path.is_none() {
        return CliDetectionResult {
            cli_type: "claude".to_string(),
            available: false,
            version: None,
            logged_in: false,
            auth_info: None,
            executable_path: None,
            error: Some("Claude Code CLI ('claude') not found in PATH. Install via: npm install -g @anthropic-ai/claude-code".to_string()),
        };
    }

    // Check if user is logged in by inspecting ~/.claude.json or running a fast auth probe
    let mut logged_in = false;
    let mut auth_info = None;

    if let Some(home_dir) = get_home_dir() {
        let claude_json = home_dir.join(".claude.json");
        if claude_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&claude_json) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if json.get("oauthAccount").is_some()
                        || json.get("userID").is_some()
                        || json.get("hasCompletedOnboarding").and_then(|v| v.as_bool()) == Some(true)
                    {
                        logged_in = true;
                        auth_info = json
                            .get("oauthAccount")
                            .and_then(|a| a.get("emailAddress"))
                            .and_then(|e| e.as_str())
                            .map(|s| format!("Logged in as {}", s))
                            .or_else(|| Some("Active Claude Code session found".to_string()));
                    }
                }
            }
        }
    }

    // Fallback: probe `claude config get`
    if !logged_in {
        let mut probe = make_cli_command("claude", &["config", "get", "oauthAccount"]);
        if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(4), probe.output()).await {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if out.status.success() && !stdout.is_empty() && stdout != "null" && stdout != "undefined" {
                logged_in = true;
                auth_info = Some("Configured via Claude CLI session".to_string());
            }
        }
    }

    CliDetectionResult {
        cli_type: "claude".to_string(),
        available: true,
        version: version_output,
        logged_in,
        auth_info: auth_info.or_else(|| {
            if logged_in {
                Some("Active Claude Subscription".to_string())
            } else {
                Some("CLI found, run 'claude login' in terminal to authenticate your Claude Pro/Team account".to_string())
            }
        }),
        executable_path: path,
        error: None,
    }
}

/// Detect GitHub CLI with Copilot extension (`gh copilot`)
async fn detect_gh_copilot_cli() -> CliDetectionResult {
    let gh_path = locate_executable("gh").await;
    let mut cmd = make_cli_command("gh", &["--version"]);
    let gh_version = match tokio::time::timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(out)) if out.status.success() => {
            let first = String::from_utf8_lossy(&out.stdout).lines().next().map(|s| s.trim().to_string());
            first
        }
        _ => None,
    };

    if gh_version.is_none() && gh_path.is_none() {
        return CliDetectionResult {
            cli_type: "gh_copilot".to_string(),
            available: false,
            version: None,
            logged_in: false,
            auth_info: None,
            executable_path: None,
            error: Some("GitHub CLI ('gh') not found in PATH. Install from https://cli.github.com/".to_string()),
        };
    }

    // Check gh auth status
    let mut auth_cmd = make_cli_command("gh", &["auth", "status"]);
    let (logged_in, auth_info) = match tokio::time::timeout(Duration::from_secs(5), auth_cmd.output()).await {
        Ok(Ok(out)) => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            if out.status.success() || combined.contains("Logged in to") {
                let user_line = combined
                    .lines()
                    .find(|l| l.contains("account") || l.contains("Logged in to"))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "Authenticated with GitHub".to_string());
                (true, Some(user_line))
            } else {
                (false, Some("Run 'gh auth login' to sign in".to_string()))
            }
        }
        _ => (false, Some("Could not verify gh auth status".to_string())),
    };

    // Check if copilot extension is installed
    let mut copilot_cmd = make_cli_command("gh", &["extension", "list"]);
    let has_copilot_ext = match tokio::time::timeout(Duration::from_secs(5), copilot_cmd.output()).await {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains("copilot") || stdout.contains("github/gh-copilot")
        }
        _ => false,
    };

    let full_info = if has_copilot_ext {
        auth_info.map(|i| format!("{} (gh-copilot extension ready)", i))
    } else {
        auth_info.map(|i| format!("{} (Note: run 'gh extension install github/gh-copilot')", i))
    };

    CliDetectionResult {
        cli_type: "gh_copilot".to_string(),
        available: true,
        version: gh_version,
        logged_in,
        auth_info: full_info,
        executable_path: gh_path,
        error: if !has_copilot_ext {
            Some("GitHub CLI found, but 'gh-copilot' extension is not yet installed. Run: gh extension install github/gh-copilot".to_string())
        } else {
            None
        },
    }
}

/// Detect Google Cloud CLI (`gcloud`) and Gemini / Application Default Credentials
async fn detect_gcloud_cli() -> CliDetectionResult {
    let gcloud_path = locate_executable("gcloud").await;
    let mut cmd = make_cli_command("gcloud", &["--version"]);
    let version = match tokio::time::timeout(Duration::from_secs(5), cmd.output()).await {
        Ok(Ok(out)) if out.status.success() => {
            let first = String::from_utf8_lossy(&out.stdout).lines().next().map(|s| s.trim().to_string());
            first
        }
        _ => None,
    };

    // Check Application Default Credentials file in standard location
    let mut adc_found = false;
    let mut adc_account = None;

    if let Some(config_dir) = get_config_dir() {
        let adc_path = config_dir.join("gcloud").join("application_default_credentials.json");
        if adc_path.exists() {
            adc_found = true;
            if let Ok(c) = std::fs::read_to_string(&adc_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&c) {
                    if let Some(client_email) = val.get("client_email").and_then(|v| v.as_str()) {
                        adc_account = Some(format!("ADC Account: {}", client_email));
                    }
                }
            }
        }
    }

    if version.is_none() && gcloud_path.is_none() && !adc_found {
        return CliDetectionResult {
            cli_type: "gcloud".to_string(),
            available: false,
            version: None,
            logged_in: false,
            auth_info: None,
            executable_path: None,
            error: Some("Google Cloud CLI ('gcloud') not found in PATH and no ADC credentials found".to_string()),
        };
    }

    let auth_info = if adc_found {
        adc_account.or_else(|| Some("Found Application Default Credentials (gcloud ADC)".to_string()))
    } else {
        Some("Run 'gcloud auth application-default login' to authorize".to_string())
    };

    CliDetectionResult {
        cli_type: "gcloud".to_string(),
        available: true,
        version,
        logged_in: adc_found,
        auth_info,
        executable_path: gcloud_path,
        error: None,
    }
}

/// Execute a prompt through the specified local CLI bridge
pub async fn execute_cli(
    cli_type: &str,
    prompt: &str,
    repo_path: Option<&str>,
) -> Result<CliExecutionResult, String> {
    let start_time = std::time::Instant::now();

    match cli_type {
        "claude" => {
            let mut cmd = make_cli_command("claude", &["-p", prompt, "--print"]);

            if let Some(dir) = repo_path {
                let p = PathBuf::from(dir);
                if p.is_dir() {
                    cmd.current_dir(p);
                }
            }

            let timeout_secs = 120;
            match tokio::time::timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
                Ok(Ok(output)) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let duration_ms = start_time.elapsed().as_millis() as u64;

                    if output.status.success() {
                        Ok(CliExecutionResult {
                            success: true,
                            output: if stdout.trim().is_empty() { stderr } else { stdout },
                            error: None,
                            duration_ms,
                        })
                    } else {
                        Ok(CliExecutionResult {
                            success: false,
                            output: stdout,
                            error: Some(format!(
                                "Claude CLI exited with code {:?}. Error: {}",
                                output.status.code(),
                                stderr.trim()
                            )),
                            duration_ms,
                        })
                    }
                }
                Ok(Err(e)) => Err(format!("Failed to execute Claude CLI: {}", e)),
                Err(_) => Err(format!(
                    "Claude CLI timed out after {} seconds. Check if Claude CLI requires interactive authentication.",
                    timeout_secs
                )),
            }
        }
        "gh_copilot" => {
            let mut cmd = make_cli_command("gh", &["copilot", "explain", prompt]);

            if let Some(dir) = repo_path {
                let p = PathBuf::from(dir);
                if p.is_dir() {
                    cmd.current_dir(p);
                }
            }

            let timeout_secs = 60;
            match tokio::time::timeout(Duration::from_secs(timeout_secs), cmd.output()).await {
                Ok(Ok(output)) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let duration_ms = start_time.elapsed().as_millis() as u64;

                    if output.status.success() {
                        Ok(CliExecutionResult {
                            success: true,
                            output: if stdout.trim().is_empty() { stderr } else { stdout },
                            error: None,
                            duration_ms,
                        })
                    } else {
                        Ok(CliExecutionResult {
                            success: false,
                            output: stdout,
                            error: Some(format!(
                                "gh copilot exited with code {:?}. Error: {}",
                                output.status.code(),
                                stderr.trim()
                            )),
                            duration_ms,
                        })
                    }
                }
                Ok(Err(e)) => Err(format!("Failed to execute gh copilot: {}", e)),
                Err(_) => Err(format!("gh copilot timed out after {} seconds", timeout_secs)),
            }
        }
        other => Err(format!("CLI execution for '{}' is not supported", other)),
    }
}
