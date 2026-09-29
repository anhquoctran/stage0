use std::process::Command;
use std::time::Instant;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use super::{
    SandboxAdapter, SandboxAdapterInfo, SandboxCapabilities, SandboxExecutionResult,
    SandboxInstanceInfo, SandboxType,
};
use crate::git::{
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
        let mut cmd = Command::new("docker");
        cmd.args(["version", "--format", "{{.Server.Version}}"]);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match cmd.output() {
            Ok(output) if output.status.success() => {
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
        "Spins up an isolated Docker container with repository access for secure, reproducible CI-style test execution and verification."
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
        let (is_available, _, err_msg) = self.check_docker_daemon();
        if !is_available {
            return Err(format!("Cannot create Docker sandbox: {}", err_msg));
        }

        let instance_id = format!("stage0-{}", uuid::Uuid::new_v4());
        let container_name = format!("stage0-box-{}", &instance_id[7..15]);

        let mount_vol = format!("{}:/workspace:ro", repo_path);
        let mut cmd = Command::new("docker");
        cmd.args([
            "run",
            "-d",
            "--name",
            &container_name,
            "-v",
            &mount_vol,
            "-w",
            "/workspace",
            &self.default_image,
            "sleep",
            "3600",
        ]);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| {
            format!("Failed to start Docker container: {}", e)
        })?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("Docker run failed: {}", err.trim()));
        }

        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();

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

    fn destroy_instance(
        &self,
        instance: &SandboxInstanceInfo,
    ) -> Result<(), String> {
        if let Some(ref cid) = instance.container_id {
            let mut cmd = Command::new("docker");
            cmd.args(["rm", "-f", cid]);

            #[cfg(windows)]
            cmd.creation_flags(CREATE_NO_WINDOW);

            let _ = cmd.output();
        }
        Ok(())
    }

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
    ) -> Result<SandboxExecutionResult, String> {
        let container_id = instance.container_id.as_deref().ok_or_else(|| {
            "Instance does not have an active Docker container ID".to_string()
        })?;

        let start = Instant::now();
        let mut cmd = Command::new("docker");
        cmd.args(["exec", container_id, command]);
        cmd.args(args);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| {
            format!("Failed to execute command in Docker container: {}", e)
        })?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(SandboxExecutionResult {
            command: format!("{} {}", command, args.join(" ")),
            stdout,
            stderr,
            exit_code,
            duration_ms,
        })
    }
}
