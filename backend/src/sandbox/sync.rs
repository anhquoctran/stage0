use std::io::Write;
use std::process::{Command, Stdio};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use super::{SandboxInstanceInfo, SandboxType};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Synchronizes uncommitted host repository changes into the designated sandbox instance.
///
/// 1. Generates a unified binary patch from host changes (`git diff --binary -U3 HEAD`).
/// 2. If the patch is empty (clean working tree), resets the sandbox back to the current commit state.
/// 3. If a patch exists:
///    - `LocalWorktree`: Reverts uncommitted edits, then pipes the patch via stdin into `git apply --whitespace=nowarn`.
///    - `Docker`: Pipes the patch via stdin into `docker exec -i <container_id> sh -c "git checkout -- . && git apply --whitespace=nowarn"`.
///    - `InMemory`: Dynamically evaluates Git objects; no disk state to mutate.
pub fn sync_changes_to_sandbox(
    instance: &SandboxInstanceInfo,
    repo_path: &str,
) -> Result<(), String> {
    let git_bin = crate::git::runner::get_active_git_path();

    // 1. Generate unified diff from host repo (both staged and unstaged tracked changes)
    let mut diff_cmd = Command::new(&git_bin);
    diff_cmd.current_dir(repo_path);
    diff_cmd.args(["diff", "--binary", "-U3", "--end-of-options", "HEAD"]);
    #[cfg(windows)]
    diff_cmd.creation_flags(CREATE_NO_WINDOW);

    let output = diff_cmd.output().map_err(|e| {
        format!("Failed to generate git diff from host repo: {}", e)
    })?;

    let patch = String::from_utf8_lossy(&output.stdout).to_string();

    match instance.adapter_type {
        SandboxType::InMemory => {
            // InMemory evaluates Git tree and blob objects in RAM on demand
            Ok(())
        }
        SandboxType::LocalWorktree => {
            let worktree_dir = instance.worktree_path.as_deref().ok_or_else(|| {
                "Worktree directory path missing for LocalWorktree instance".to_string()
            })?;

            if patch.trim().is_empty() {
                // Working tree is clean: reset worktree to commit state
                let mut reset_cmd = Command::new(&git_bin);
                reset_cmd.current_dir(worktree_dir);
                reset_cmd.args(["reset", "--hard", "HEAD"]);
                #[cfg(windows)]
                reset_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = reset_cmd.output();

                let mut clean_cmd = Command::new(&git_bin);
                clean_cmd.current_dir(worktree_dir);
                clean_cmd.args(["clean", "-fd"]);
                #[cfg(windows)]
                clean_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = clean_cmd.output();
            } else {
                // Revert any previous uncommitted worktree changes before applying fresh patch
                let mut checkout_cmd = Command::new(&git_bin);
                checkout_cmd.current_dir(worktree_dir);
                checkout_cmd.args(["checkout", "--", "."]);
                #[cfg(windows)]
                checkout_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = checkout_cmd.output();

                let mut apply_cmd = Command::new(&git_bin);
                apply_cmd.current_dir(worktree_dir);
                apply_cmd.args(["apply", "--whitespace=nowarn"]);
                apply_cmd.stdin(Stdio::piped());
                apply_cmd.stdout(Stdio::piped());
                apply_cmd.stderr(Stdio::piped());
                #[cfg(windows)]
                apply_cmd.creation_flags(CREATE_NO_WINDOW);

                let mut child = apply_cmd.spawn().map_err(|e| {
                    format!("Failed to spawn git apply in worktree: {}", e)
                })?;

                if let Some(mut stdin) = child.stdin.take() {
                    stdin.write_all(patch.as_bytes()).map_err(|e| {
                        format!("Failed to pipe patch to git apply stdin: {}", e)
                    })?;
                }

                let apply_out = child.wait_with_output().map_err(|e| {
                    format!("git apply failed in worktree: {}", e)
                })?;

                if !apply_out.status.success() {
                    let err = String::from_utf8_lossy(&apply_out.stderr).to_string();
                    return Err(format!("git apply in worktree rejected patch: {}", err.trim()));
                }
            }
            Ok(())
        }
        SandboxType::Docker => {
            let container_id = instance.container_id.as_deref().ok_or_else(|| {
                "Container ID missing for Docker sandbox instance".to_string()
            })?;

            if patch.trim().is_empty() {
                // Working tree is clean: reset container workspace
                let mut reset_cmd = Command::new("docker");
                reset_cmd.args([
                    "exec",
                    container_id,
                    "sh",
                    "-c",
                    "cd /workspace && (git reset --hard HEAD 2>/dev/null || true) && (git clean -fd 2>/dev/null || true)",
                ]);
                #[cfg(windows)]
                reset_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = reset_cmd.output();
            } else {
                // Pipe patch to docker exec git apply
                let mut apply_cmd = Command::new("docker");
                apply_cmd.args([
                    "exec",
                    "-i",
                    container_id,
                    "sh",
                    "-c",
                    "cd /workspace && (git checkout -- . 2>/dev/null || true) && git apply --whitespace=nowarn",
                ]);
                apply_cmd.stdin(Stdio::piped());
                apply_cmd.stdout(Stdio::piped());
                apply_cmd.stderr(Stdio::piped());
                #[cfg(windows)]
                apply_cmd.creation_flags(CREATE_NO_WINDOW);

                let mut child = apply_cmd.spawn().map_err(|e| {
                    format!("Failed to spawn docker exec git apply: {}", e)
                })?;

                if let Some(mut stdin) = child.stdin.take() {
                    stdin.write_all(patch.as_bytes()).map_err(|e| {
                        format!("Failed to pipe patch to Docker container stdin: {}", e)
                    })?;
                }

                let apply_out = child.wait_with_output().map_err(|e| {
                    format!("docker exec git apply failed: {}", e)
                })?;

                if !apply_out.status.success() {
                    let err = String::from_utf8_lossy(&apply_out.stderr).to_string();
                    return Err(format!("Docker sandbox failed to apply host patch: {}", err.trim()));
                }
            }
            Ok(())
        }
    }
}
