use super::{make_cli_command, CliExecutionResult};
use std::{path::PathBuf, time::Duration};

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
                            output: if stdout.trim().is_empty() {
                                stderr
                            } else {
                                stdout
                            },
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
                Err(_) => Err(format!(
                    "gh copilot timed out after {} seconds",
                    timeout_secs
                )),
            }
        }
        "grok" | "xai_grok" => {
            let mut cmd = make_cli_command("grok", &["build", "--prompt", prompt]);

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
                            output: if stdout.trim().is_empty() {
                                stderr
                            } else {
                                stdout
                            },
                            error: None,
                            duration_ms,
                        })
                    } else {
                        Ok(CliExecutionResult {
                            success: false,
                            output: stdout,
                            error: Some(format!(
                                "Grok CLI exited with code {:?}. Error: {}",
                                output.status.code(),
                                stderr.trim()
                            )),
                            duration_ms,
                        })
                    }
                }
                Ok(Err(e)) => Err(format!("Failed to execute Grok CLI: {}", e)),
                Err(_) => Err(format!("Grok CLI timed out after {} seconds", timeout_secs)),
            }
        }
        other => Err(format!("CLI execution for '{}' is not supported", other)),
    }
}
