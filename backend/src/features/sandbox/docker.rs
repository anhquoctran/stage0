#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Instant;

use super::{
    validate_sandbox_command, SandboxAdapter, SandboxAdapterInfo, SandboxCapabilities,
    SandboxExecutionResult, SandboxInstanceInfo, SandboxType,
};
use crate::features::git::{
    conflict::{check_conflicts, get_conflicted_file_preview},
    diff::get_mr_diff,
    ConflictFilePreview, ConflictReport, MrDiffPayload,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct DockerSandboxAdapter {
    default_image: String,
}

impl DockerSandboxAdapter {
    pub fn new() -> Self {
        Self {
            default_image: "alpine:latest".to_string(),
        }
    }

    pub fn with_image(image: String) -> Self {
        Self {
            default_image: image,
        }
    }

    fn check_docker_daemon(&self) -> (bool, Option<String>, String) {
        match run_docker_command(
            &["version", "--format", "{{.Server.Version}}"],
            64 * 1024,
            64 * 1024,
            std::time::Duration::from_secs(5),
        ) {
            Ok(output) if output.status.success() && !output.output_truncated => {
                let ver = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let display_ver = if ver.is_empty() {
                    "Docker Engine (Active)".to_string()
                } else {
                    format!("Docker Engine v{}", ver)
                };
                (
                    true,
                    Some(display_ver),
                    format!("Docker Daemon is running (Default Image: {})", self.default_image),
                )
            }
            Ok(_) => (
                false,
                None,
                "Docker is installed, but the Docker daemon is not running. Please start Docker Desktop or the dockerd service.".to_string(),
            ),
            Err(_) => (
                false,
                None,
                "Docker CLI not found on system PATH. Install Docker Desktop or Docker engine to enable containerized sandboxing.".to_string(),
            ),
        }
    }
}

impl Default for DockerSandboxAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SandboxAdapter for DockerSandboxAdapter {
    fn adapter_type(&self) -> SandboxType {
        SandboxType::Docker
    }

    fn name(&self) -> &str {
        "Docker Container Sandbox"
    }

    fn description(&self) -> &str {
        "Copies the selected source tree into a writable Docker container. No host directory is mounted; networking is enabled and resource limits are not configured by Stage0."
    }

    fn capabilities(&self) -> SandboxCapabilities {
        SandboxCapabilities {
            can_run_commands: true,
            can_write_files: true,
            isolation_level: "container".to_string(),
            requires_daemon: true,
            supports_networking: true,
        }
    }

    fn get_adapter_info(&self) -> SandboxAdapterInfo {
        let (is_available, version_info, status_message) = self.check_docker_daemon();
        SandboxAdapterInfo {
            adapter_type: self.adapter_type(),
            name: self.name().to_string(),
            description: self.description().to_string(),
            is_available,
            version_info,
            status_message,
            capabilities: self.capabilities(),
        }
    }

    fn get_diff(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<MrDiffPayload, String> {
        get_mr_diff(repo_path, base, compare)
    }

    fn check_conflicts(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<ConflictReport, String> {
        check_conflicts(repo_path, base, compare)
    }

    fn get_conflict_preview(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
        file_path: &str,
    ) -> Result<ConflictFilePreview, String> {
        get_conflicted_file_preview(repo_path, base, compare, file_path)
    }

    fn create_instance(
        &self,
        repo_path: &str,
        base: &str,
        compare: &str,
    ) -> Result<SandboxInstanceInfo, String> {
        let target_ref = crate::features::git::runner::resolve_ref(repo_path, compare)
            .map(|(commit, _)| commit)?;
        let (is_available, _, err_msg) = self.check_docker_daemon();
        if !is_available {
            return Err(format!("Cannot create Docker sandbox: {}", err_msg));
        }

        let instance_id = format!("stage0-{}", uuid::Uuid::new_v4());
        let container_name = format!("stage0-box-{}", &instance_id[7..15]);
        let instance_label = format!("com.stage0.instance={}", &instance_id[7..]);

        // 1. Launch isolated container WITHOUT mounting host filesystem
        const MAX_ARCHIVE_BYTES: usize = 128 * 1024 * 1024;
        let run_args = [
            "run",
            "-d",
            "--name",
            &container_name,
            "--label",
            "com.stage0.sandbox=true",
            "--label",
            &instance_label,
            "-w",
            "/workspace",
            &self.default_image,
            "sleep",
            "86400",
        ];
        let output = match run_docker_command(
            &run_args,
            64 * 1024,
            256 * 1024,
            std::time::Duration::from_secs(30),
        ) {
            Ok(output) => output,
            Err(error) => {
                return Err(cleanup_and_report(
                    &container_name,
                    format!("Failed to start Docker container: {}", error),
                ));
            }
        };
        if !output.status.success() || output.output_truncated {
            let err = crate::features::git::runner::redact_sensitive_text(
                &String::from_utf8_lossy(&output.stderr),
            );
            let message = if output.output_truncated {
                "Docker run exceeded the configured output limit and was stopped.".to_string()
            } else if err.trim().is_empty() {
                "Docker run failed to start a container.".to_string()
            } else {
                format!("Docker run failed: {}", err.trim())
            };
            return Err(cleanup_and_report(&container_name, message));
        }

        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if container_id.is_empty()
            || container_id.len() > 128
            || !container_id
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err(cleanup_and_report(
                &container_name,
                "Docker returned an invalid container identifier.".to_string(),
            ));
        }

        // 2. Ensure /workspace directory exists inside container
        let mkdir = run_docker_command(
            &["exec", &container_id, "mkdir", "-p", "/workspace"],
            64 * 1024,
            256 * 1024,
            std::time::Duration::from_secs(30),
        );
        if !matches!(mkdir, Ok(ref output) if output.status.success() && !output.output_truncated) {
            return Err(cleanup_and_report(
                &container_id,
                "Failed to prepare Docker sandbox workspace.".to_string(),
            ));
        }

        // 3. Export clean source tree from host repository via git archive directly into container
        let git_bin = crate::features::git::runner::get_active_git_path();
        let mut git_cmd = Command::new(git_bin);
        git_cmd.current_dir(repo_path);
        git_cmd.args(["archive", "--format=tar", &target_ref]);
        git_cmd.env("GIT_TERMINAL_PROMPT", "0");
        let mut git_archive = crate::common::process::run_bounded_command(
            &mut git_cmd,
            MAX_ARCHIVE_BYTES,
            1024 * 1024,
            std::time::Duration::from_secs(120),
        )
        .map_err(|error| cleanup_and_report(&container_id, error))?;
        if !git_archive.status.success() || git_archive.output_truncated {
            let message = if git_archive.output_truncated {
                "Docker sandbox source archive exceeds the 128 MiB safety limit.".to_string()
            } else {
                format!(
                    "Failed to archive Docker sandbox source: {}",
                    crate::features::git::runner::redact_sensitive_text(&String::from_utf8_lossy(
                        &git_archive.stderr
                    ),)
                )
            };
            return Err(cleanup_and_report(&container_id, message));
        }

        let tar_args = ["exec", "-i", &container_id, "tar", "-x", "-C", "/workspace"];
        let tar_out = run_docker_with_input(
            &tar_args,
            std::mem::take(&mut git_archive.stdout),
            64 * 1024,
            256 * 1024,
            std::time::Duration::from_secs(120),
        );
        let tar_out = match tar_out {
            Ok(output) if output.status.success() && !output.output_truncated => output,
            Ok(output) => {
                let detail = crate::features::git::runner::redact_sensitive_text(
                    &String::from_utf8_lossy(&output.stderr),
                );
                let message = if output.output_truncated {
                    "Docker source extraction exceeded the configured output limit.".to_string()
                } else if detail.trim().is_empty() {
                    "Failed to unpack source into Docker container.".to_string()
                } else {
                    format!(
                        "Failed to unpack source into Docker container: {}",
                        detail.trim()
                    )
                };
                return Err(cleanup_and_report(&container_id, message));
            }
            Err(error) => {
                return Err(cleanup_and_report(
                    &container_id,
                    format!("Docker source extraction failed: {}", error),
                ));
            }
        };
        drop(tar_out);

        // 4. Initialize Git inside the container; do not report a usable sandbox
        // if package installation or initial commit silently failed.
        let init_script = "set -eu; \
                           if ! command -v git >/dev/null 2>&1; then \
                             command -v apk >/dev/null 2>&1 || { echo 'Git is unavailable and apk is missing' >&2; exit 1; }; \
                             apk add --no-cache git >/dev/null; \
                           fi; \
                           cd /workspace; git init >/dev/null; \
                           git config user.name 'Stage0 Sandbox'; \
                           git config user.email 'sandbox@stage0.local'; \
                           git add -A; git commit -m 'Initial sandbox state' >/dev/null";
        let init = run_docker_command(
            &["exec", &container_id, "sh", "-c", init_script],
            64 * 1024,
            256 * 1024,
            std::time::Duration::from_secs(120),
        );
        if !matches!(init, Ok(ref output) if output.status.success() && !output.output_truncated) {
            return Err(cleanup_and_report(
                &container_id,
                "Failed to initialize Git in the Docker sandbox.".to_string(),
            ));
        }

        Ok(SandboxInstanceInfo {
            id: instance_id,
            adapter_type: SandboxType::Docker,
            repo_path: repo_path.to_string(),
            base_branch: base.to_string(),
            compare_branch: compare.to_string(),
            worktree_path: None,
            container_id: Some(container_id),
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn destroy_instance(&self, instance: &SandboxInstanceInfo) -> Result<(), String> {
        if let Some(ref cid) = instance.container_id {
            remove_container(cid)?;
        }
        Ok(())
    }

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
        timeout: std::time::Duration,
    ) -> Result<SandboxExecutionResult, String> {
        let valid_command = validate_sandbox_command(command, args)?;
        let container_id = instance
            .container_id
            .as_deref()
            .ok_or_else(|| "Instance does not have an active Docker container ID".to_string())?;

        let start = Instant::now();
        let mut cmd = Command::new("docker");
        cmd.args([
            "exec",
            "-e",
            "GIT_ALLOW_PROTOCOL=git:http:https:ssh",
            container_id,
            &valid_command,
        ]);
        cmd.args(args);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = match crate::common::process::run_bounded_command(
            &mut cmd,
            1024 * 1024,
            1024 * 1024,
            timeout,
        ) {
            Ok(output) => output,
            Err(error) if error.contains("timed out") => {
                stop_container(container_id);
                return Err("Docker command timed out; the sandbox container was stopped and must be recreated.".to_string());
            }
            Err(error) => {
                return Err(format!(
                    "Failed to execute command in Docker container: {}",
                    error
                ))
            }
        };

        if output.output_truncated {
            stop_container(container_id);
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if output.output_truncated {
            stderr.push_str("\n[Output limit exceeded; the Docker sandbox container was stopped and must be recreated.]");
        }
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(SandboxExecutionResult {
            command: crate::features::git::runner::redact_sensitive_text(&format!(
                "{} {}",
                valid_command,
                args.join(" ")
            )),
            stdout,
            stderr,
            exit_code,
            duration_ms,
            output_truncated: output.output_truncated,
        })
    }
}

fn run_docker_command(
    args: &[&str],
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: std::time::Duration,
) -> Result<crate::common::process::BoundedOutput, String> {
    let mut command = Command::new("docker");
    command.args(args);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    crate::common::process::run_bounded_command(&mut command, stdout_limit, stderr_limit, timeout)
}

fn run_docker_with_input(
    args: &[&str],
    input: Vec<u8>,
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: std::time::Duration,
) -> Result<crate::common::process::BoundedOutput, String> {
    let mut command = Command::new("docker");
    command.args(args);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    crate::common::process::run_bounded_command_with_input(
        &mut command,
        input,
        stdout_limit,
        stderr_limit,
        timeout,
    )
}

fn cleanup_and_report(container_id: &str, original_error: String) -> String {
    match remove_container(container_id) {
        Ok(()) => format!("{} The temporary container was removed.", original_error),
        Err(cleanup_error) => format!(
            "{} Cleanup did not complete: {}",
            original_error, cleanup_error
        ),
    }
}

fn remove_container(container_id: &str) -> Result<(), String> {
    let output = run_docker_command(
        &["rm", "-f", container_id],
        64 * 1024,
        256 * 1024,
        std::time::Duration::from_secs(10),
    )?;
    if output.status.success() {
        Ok(())
    } else {
        let detail = crate::features::git::runner::redact_sensitive_text(&String::from_utf8_lossy(
            &output.stderr,
        ));
        Err(if detail.trim().is_empty() {
            "Docker container cleanup failed".to_string()
        } else {
            format!("Docker container cleanup failed: {}", detail.trim())
        })
    }
}

fn stop_container(container_id: &str) {
    let _ = run_docker_command(
        &["kill", container_id],
        16 * 1024,
        64 * 1024,
        std::time::Duration::from_secs(10),
    );
}
