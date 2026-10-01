use std::path::{Path, PathBuf};
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
    runner::run_git,
    ConflictFilePreview, ConflictReport, MrDiffPayload,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const ALLOWED_COMMANDS: &[&str] = &[
    "git", "cargo", "rustc", "npm", "npx", "pnpm", "yarn", "bun",
    "node", "deno", "go", "python", "python3", "pytest", "mvn", "gradle",
    "make", "cmake", "dotnet",
];

fn validate_sandbox_command(command: &str, args: &[String]) -> Result<String, String> {
    let trimmed_cmd = command.trim();
    if trimmed_cmd.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    if trimmed_cmd.contains('/') || trimmed_cmd.contains('\\') || trimmed_cmd.contains(':') {
        return Err(format!(
            "Command path traversal prohibited: '{}'. Only whitelisted toolchain commands are allowed.",
            trimmed_cmd
        ));
    }

    let base_name = trimmed_cmd
        .strip_suffix(".exe")
        .or_else(|| trimmed_cmd.strip_suffix(".cmd"))
        .or_else(|| trimmed_cmd.strip_suffix(".bat"))
        .unwrap_or(trimmed_cmd)
        .to_lowercase();

    if !ALLOWED_COMMANDS.contains(&base_name.as_str()) {
        return Err(format!(
            "Execution of '{}' is not permitted in sandbox. Permitted binaries: {:?}",
            trimmed_cmd, ALLOWED_COMMANDS
        ));
    }

    for arg in args {
        if arg.contains('\0') {
            return Err("Argument contains invalid null byte".to_string());
        }
    }

    Ok(trimmed_cmd.to_string())
}

pub struct LocalWorktreeSandboxAdapter {
    base_worktree_dir: PathBuf,
}

impl LocalWorktreeSandboxAdapter {
    pub fn new() -> Self {
        let temp_dir = std::env::temp_dir().join("stage0-worktrees");
        if !temp_dir.exists() {
            let _ = std::fs::create_dir_all(&temp_dir);
        }
        Self {
            base_worktree_dir: temp_dir,
        }
    }

    pub fn with_custom_dir(dir: PathBuf) -> Self {
        if !dir.exists() {
            let _ = std::fs::create_dir_all(&dir);
        }
        Self {
            base_worktree_dir: dir,
        }
    }

    fn check_worktree_support(&self) -> (bool, Option<String>, String) {
        let git_bin = crate::git::runner::get_active_git_path();
        let mut cmd = Command::new(&git_bin);
        cmd.args(["worktree", "list"]);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match cmd.output() {
            Ok(output) if output.status.success() => (
                true,
                Some("Git Worktree (Native CLI)".to_string()),
                format!(
                    "Available & Ready (Storage: {})",
                    self.base_worktree_dir.to_string_lossy()
                ),
            ),
            Ok(output) => {
                let err = String::from_utf8_lossy(&output.stderr).to_string();
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
        "Provisions an isolated Git worktree on disk to evaluate changes, run tests, and execute linters without altering your current branch or workspace."
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
        let instance_id = format!("wt-{}", uuid::Uuid::new_v4());
        let worktree_path = self.base_worktree_dir.join(&instance_id);

        if !self.base_worktree_dir.exists() {
            let _ = std::fs::create_dir_all(&self.base_worktree_dir);
        }

        // Add detached worktree checking out compare branch
        let path_str = worktree_path.to_string_lossy().to_string();
        let add_res = run_git(
            repo_path,
            &["worktree", "add", "--detach", &path_str, compare],
        )?;

        if !add_res.success {
            return Err(format!(
                "Failed to create git worktree: {}",
                add_res.stderr.trim()
            ));
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

    fn destroy_instance(
        &self,
        instance: &SandboxInstanceInfo,
    ) -> Result<(), String> {
        if let Some(ref wt_path) = instance.worktree_path {
            // Remove worktree via git
            let _ = run_git(
                &instance.repo_path,
                &["worktree", "remove", "--force", wt_path],
            );
            let _ = run_git(&instance.repo_path, &["worktree", "prune"]);

            // Ensure physical folder is cleaned up
            let p = Path::new(wt_path);
            if p.exists() {
                let _ = std::fs::remove_dir_all(p);
            }
        }
        Ok(())
    }

    fn execute_command(
        &self,
        instance: &SandboxInstanceInfo,
        command: &str,
        args: &[String],
    ) -> Result<SandboxExecutionResult, String> {
        let valid_cmd = validate_sandbox_command(command, args)?;

        let worktree_dir = instance.worktree_path.as_deref().ok_or_else(|| {
            "Instance does not have an active worktree path".to_string()
        })?;

        let canonical_worktree = Path::new(worktree_dir).canonicalize().map_err(|e| {
            format!("Invalid worktree path '{}': {}", worktree_dir, e)
        })?;

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

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| {
            format!("Failed to execute '{}' in worktree: {}", valid_cmd, e)
        })?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(SandboxExecutionResult {
            command: format!("{} {}", valid_cmd, args.join(" ")),
            stdout,
            stderr,
            exit_code,
            duration_ms,
        })
    }
}
