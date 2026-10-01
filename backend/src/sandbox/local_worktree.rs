use std::io;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

use super::{
    validate_sandbox_command, SandboxAdapter, SandboxAdapterInfo, SandboxCapabilities,
    SandboxExecutionResult, SandboxInstanceInfo, SandboxType,
};
use crate::git::{
    conflict::{check_conflicts, get_conflicted_file_preview},
    diff::get_mr_diff,
    runner::{resolve_ref, run_git},
    ConflictFilePreview, ConflictReport, MrDiffPayload,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct LocalWorktreeSandboxAdapter {
    base_worktree_dir: PathBuf,
}

fn ensure_private_worktree_dir(path: &Path) -> io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Worktree cache directory must not be a symbolic link",
            ));
        }
        Ok(metadata) if !metadata.is_dir() => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Worktree cache path is not a directory",
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::DirBuilderExt;
                std::fs::DirBuilder::new()
                    .recursive(true)
                    .mode(0o700)
                    .create(path)?;
            }
            #[cfg(not(unix))]
            std::fs::create_dir_all(path)?;
        }
        Err(error) => return Err(error),
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

impl LocalWorktreeSandboxAdapter {
    pub fn new() -> Self {
        // Keep ad-hoc/test instances private and disjoint. The application
        // supplies its per-user cache path through `with_custom_dir`.
        let temp_dir = std::env::temp_dir().join(format!(
            "stage0-worktrees-{}",
            uuid::Uuid::new_v4().simple()
        ));
        Self {
            base_worktree_dir: temp_dir,
        }
    }

    pub fn with_custom_dir(dir: PathBuf) -> Self {
        Self {
            base_worktree_dir: dir,
        }
    }

    pub fn remove_empty_base_dir(&self) -> Result<(), String> {
        match std::fs::remove_dir(&self.base_worktree_dir) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!(
                "Unable to remove empty worktree cache directory: {}",
                error
            )),
        }
    }

    fn check_worktree_support(&self) -> (bool, Option<String>, String) {
        let git_bin = crate::git::runner::get_active_git_path();
        let mut cmd = Command::new(&git_bin);
        cmd.args(["worktree", "list"]);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match crate::process::run_bounded_command(
            &mut cmd,
            64 * 1024,
            64 * 1024,
            std::time::Duration::from_secs(5),
        ) {
            Ok(output) if output.status.success() && !output.output_truncated => (
                true,
                Some("Git Worktree (Native CLI)".to_string()),
                format!(
                    "Available & Ready (Storage: {})",
                    self.base_worktree_dir.to_string_lossy()
                ),
            ),
            Ok(output) => {
                let err = crate::git::runner::redact_sensitive_text(&String::from_utf8_lossy(
                    &output.stderr,
                ));
                (
                    false,
                    None,
                    format!("Git worktree command returned an error: {}", err.trim()),
                )
            }
            Err(e) => (
                false,
                None,
                format!("Failed to execute git worktree: {}", e),
            ),
        }
    }
}

impl Default for LocalWorktreeSandboxAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl SandboxAdapter for LocalWorktreeSandboxAdapter {
    fn adapter_type(&self) -> SandboxType {
        SandboxType::LocalWorktree
    }

    fn name(&self) -> &str {
        "Local Worktree Sandbox"
    }

    fn description(&self) -> &str {
        "Provisions a detached Git worktree for commands and tests. Commands run on the host as the current user; the worktree does not provide operating-system isolation."
    }

    fn capabilities(&self) -> SandboxCapabilities {
        SandboxCapabilities {
            can_run_commands: true,
            can_write_files: true,
            isolation_level: "local_worktree".to_string(),
            requires_daemon: false,
            supports_networking: true,
        }
    }

    fn get_adapter_info(&self) -> SandboxAdapterInfo {
        let (is_available, version_info, status_message) = self.check_worktree_support();
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
        ensure_private_worktree_dir(&self.base_worktree_dir)
            .map_err(|error| format!("Unable to prepare private worktree cache: {}", error))?;

        let instance_id = format!("wt-{}", uuid::Uuid::new_v4());
        let worktree_path = self.base_worktree_dir.join(&instance_id);

        // Add detached worktree checking out compare branch
        let path_str = worktree_path.to_string_lossy().to_string();
        let (compare_commit, _) = resolve_ref(repo_path, compare)?;
        let add_res = match run_git(
            repo_path,
            &["worktree", "add", "--detach", &path_str, &compare_commit],
        ) {
            Ok(result) => result,
            Err(error) => {
                let cleanup_error = cleanup_partial_worktree(repo_path, &worktree_path);
                return Err(match cleanup_error {
                    Some(cleanup_error) => format!(
                        "{}; partial worktree cleanup failed: {}",
                        error, cleanup_error
                    ),
                    None => error,
                });
            }
        };

        if !add_res.success {
            let detail = crate::git::runner::redact_sensitive_text(add_res.stderr.trim());
            let cleanup_error = cleanup_partial_worktree(repo_path, &worktree_path);
            return Err(match cleanup_error {
                Some(cleanup_error) => format!(
                    "Failed to create git worktree: {}; partial worktree cleanup failed: {}",
                    detail, cleanup_error
                ),
                None => format!("Failed to create git worktree: {}", detail),
            });
        }

        Ok(SandboxInstanceInfo {
            id: instance_id,
            adapter_type: SandboxType::LocalWorktree,
            repo_path: repo_path.to_string(),
            base_branch: base.to_string(),
            compare_branch: compare.to_string(),
            worktree_path: Some(path_str),
            container_id: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    fn destroy_instance(&self, instance: &SandboxInstanceInfo) -> Result<(), String> {
        if let Some(ref wt_path) = instance.worktree_path {
            // Remove worktree via git
            let _ = crate::git::runner::run_git_with_limits(
                &instance.repo_path,
                &["worktree", "remove", "--force", wt_path],
                64 * 1024,
                64 * 1024,
                std::time::Duration::from_secs(5),
            );

            // Ensure physical folder is cleaned up
            let p = Path::new(wt_path);
            if p.exists() {
                if !p.starts_with(&self.base_worktree_dir) {
                    return Err(
                        "Refusing to remove a worktree outside Stage0's private cache".to_string(),
                    );
                }
                std::fs::remove_dir_all(p)
                    .map_err(|error| format!("Failed to remove worktree directory: {}", error))?;
            }

            let prune = crate::git::runner::run_git_with_limits(
                &instance.repo_path,
                &["worktree", "prune"],
                64 * 1024,
                64 * 1024,
                std::time::Duration::from_secs(5),
            )
            .map_err(|error| format!("Failed to prune Git worktree metadata: {}", error))?;
            if !prune.success {
                return Err(format!(
                    "Failed to prune Git worktree metadata: {}",
                    crate::git::runner::redact_sensitive_text(prune.stderr.trim())
                ));
            }
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
        let valid_cmd = validate_sandbox_command(command, args)?;

        let worktree_dir = instance
            .worktree_path
            .as_deref()
            .ok_or_else(|| "Instance does not have an active worktree path".to_string())?;

        let canonical_worktree = Path::new(worktree_dir)
            .canonicalize()
            .map_err(|e| format!("Invalid worktree path '{}': {}", worktree_dir, e))?;

        if !canonical_worktree.exists() {
            return Err(format!(
                "Worktree path does not exist on disk: {}",
                canonical_worktree.display()
            ));
        }

        let start = Instant::now();
        let mut cmd = Command::new(&valid_cmd);
        cmd.current_dir(&canonical_worktree);
        cmd.args(args);
        cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output =
            crate::process::run_bounded_command(&mut cmd, 1024 * 1024, 1024 * 1024, timeout)
                .map_err(|e| format!("Failed to execute command in worktree: {}", e))?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(SandboxExecutionResult {
            command: crate::git::runner::redact_sensitive_text(&format!(
                "{} {}",
                valid_cmd,
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

fn cleanup_partial_worktree(repo_path: &str, worktree_path: &Path) -> Option<String> {
    if worktree_path.exists() {
        if let Err(error) = std::fs::remove_dir_all(worktree_path) {
            return Some(format!(
                "failed to remove partial worktree directory: {}",
                error
            ));
        }
    }
    match crate::git::runner::run_git_with_limits(
        repo_path,
        &["worktree", "prune"],
        64 * 1024,
        64 * 1024,
        std::time::Duration::from_secs(5),
    ) {
        Ok(result) if result.success => None,
        Ok(result) => Some(crate::git::runner::redact_sensitive_text(
            result.stderr.trim(),
        )),
        Err(error) => Some(error),
    }
}
