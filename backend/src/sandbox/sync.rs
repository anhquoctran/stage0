#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Duration;

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
    if matches!(instance.adapter_type, SandboxType::InMemory) {
        return Ok(());
    }

    let git_bin = crate::git::runner::get_active_git_path();

    // 1. Generate unified diff from host repo (both staged and unstaged tracked changes)
    let mut diff_cmd = Command::new(&git_bin);
    diff_cmd.current_dir(repo_path);
    diff_cmd.args([
        "diff",
        "--binary",
        "--no-ext-diff",
        "--no-textconv",
        "-U3",
        "--end-of-options",
        "HEAD",
    ]);
    #[cfg(windows)]
    diff_cmd.creation_flags(CREATE_NO_WINDOW);

    const MAX_PATCH_BYTES: usize = 64 * 1024 * 1024;
    let output = crate::process::run_bounded_command(
        &mut diff_cmd,
        MAX_PATCH_BYTES,
        1024 * 1024,
        Duration::from_secs(120),
    )
    .map_err(|error| format!("Failed to generate git diff from host repo: {}", error))?;
    if !output.status.success() || output.output_truncated {
        let detail = String::from_utf8_lossy(&output.stderr);
        let detail = crate::git::runner::redact_sensitive_text(detail.trim());
        return Err(if output.output_truncated {
            format!("Host repository patch exceeded the 64 MiB sandbox sync limit")
        } else if detail.is_empty() {
            "Failed to generate git diff from host repo".to_string()
        } else {
            format!("Failed to generate git diff from host repo: {}", detail)
        });
    }
    let patch = output.stdout;

    match instance.adapter_type {
        SandboxType::InMemory => {
            unreachable!("in-memory sandboxes return before generating a patch")
        }
        SandboxType::LocalWorktree => {
            let worktree_dir = instance.worktree_path.as_deref().ok_or_else(|| {
                "Worktree directory path missing for LocalWorktree instance".to_string()
            })?;

            if patch.is_empty() {
                // Working tree is clean: reset worktree to commit state
                let mut reset_cmd = Command::new(&git_bin);
                reset_cmd.current_dir(worktree_dir);
                reset_cmd.args(["reset", "--hard", "HEAD"]);
                #[cfg(windows)]
                reset_cmd.creation_flags(CREATE_NO_WINDOW);
                run_maintenance_command(&mut reset_cmd, "Failed to reset sandbox worktree")?;

                let mut clean_cmd = Command::new(&git_bin);
                clean_cmd.current_dir(worktree_dir);
                clean_cmd.args(["clean", "-fd"]);
                #[cfg(windows)]
                clean_cmd.creation_flags(CREATE_NO_WINDOW);
                run_maintenance_command(&mut clean_cmd, "Failed to clean sandbox worktree")?;
            } else {
                // Clear both the worktree and index before applying the host
                // snapshot; `checkout -- .` alone leaves staged edits behind.
                let mut reset_cmd = Command::new(&git_bin);
                reset_cmd.current_dir(worktree_dir);
                reset_cmd.args(["reset", "--hard", "HEAD"]);
                #[cfg(windows)]
                reset_cmd.creation_flags(CREATE_NO_WINDOW);
                run_maintenance_command(&mut reset_cmd, "Failed to reset sandbox worktree edits")?;

                let mut clean_cmd = Command::new(&git_bin);
                clean_cmd.current_dir(worktree_dir);
                clean_cmd.args(["clean", "-fd"]);
                #[cfg(windows)]
                clean_cmd.creation_flags(CREATE_NO_WINDOW);
                run_maintenance_command(&mut clean_cmd, "Failed to clean sandbox worktree edits")?;

                let mut apply_cmd = Command::new(&git_bin);
                apply_cmd.current_dir(worktree_dir);
                apply_cmd.args(["apply", "--whitespace=nowarn"]);
                #[cfg(windows)]
                apply_cmd.creation_flags(CREATE_NO_WINDOW);

                let apply_out = crate::process::run_bounded_command_with_input(
                    &mut apply_cmd,
                    patch,
                    64 * 1024,
                    256 * 1024,
                    Duration::from_secs(120),
                )?;
                if !apply_out.status.success() || apply_out.output_truncated {
                    let err = String::from_utf8_lossy(&apply_out.stderr);
                    return Err(format!(
                        "git apply in worktree failed: {}",
                        crate::git::runner::redact_sensitive_text(err.trim())
                    ));
                }
            }
            Ok(())
        }
        SandboxType::Docker => {
            let container_id = instance
                .container_id
                .as_deref()
                .ok_or_else(|| "Container ID missing for Docker sandbox instance".to_string())?;

            if patch.is_empty() {
                // Working tree is clean: reset container workspace
                let mut reset_cmd = Command::new("docker");
                reset_cmd.args([
                    "exec",
                    container_id,
                    "sh",
                    "-c",
                    "cd /workspace && git reset --hard HEAD && git clean -fd",
                ]);
                #[cfg(windows)]
                reset_cmd.creation_flags(CREATE_NO_WINDOW);
                run_maintenance_command(&mut reset_cmd, "Failed to reset Docker sandbox")?;
            } else {
                // Pipe patch to docker exec git apply
                let mut apply_cmd = Command::new("docker");
                apply_cmd.args([
                    "exec",
                    "-i",
                    container_id,
                    "sh",
                    "-c",
                    "cd /workspace && git reset --hard HEAD && git clean -fd && git apply --whitespace=nowarn",
                ]);
                #[cfg(windows)]
                apply_cmd.creation_flags(CREATE_NO_WINDOW);

                let apply_out = crate::process::run_bounded_command_with_input(
                    &mut apply_cmd,
                    patch,
                    64 * 1024,
                    256 * 1024,
                    Duration::from_secs(120),
                )?;
                if !apply_out.status.success() || apply_out.output_truncated {
                    let err = String::from_utf8_lossy(&apply_out.stderr);
                    return Err(format!(
                        "Docker sandbox failed to apply host patch: {}",
                        crate::git::runner::redact_sensitive_text(err.trim())
                    ));
                }
            }
            Ok(())
        }
    }
}

fn run_maintenance_command(command: &mut Command, context: &str) -> Result<(), String> {
    let output = crate::process::run_bounded_command(
        command,
        64 * 1024,
        256 * 1024,
        Duration::from_secs(120),
    )?;
    if output.status.success() && !output.output_truncated {
        return Ok(());
    }
    let detail = String::from_utf8_lossy(&output.stderr);
    let detail = crate::git::runner::redact_sensitive_text(detail.trim());
    if output.output_truncated {
        Err(format!("{} (subprocess output limit exceeded)", context))
    } else if detail.is_empty() {
        Err(context.to_string())
    } else {
        Err(format!("{}: {}", context, detail))
    }
}
