use std::process::{Command, Output};
use std::sync::RwLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static ACTIVE_GIT_PATH: RwLock<Option<String>> = RwLock::new(None);

pub fn set_active_git_path(path: Option<String>) {
    if let Ok(mut lock) = ACTIVE_GIT_PATH.write() {
        *lock = path;
    }
}

pub fn get_active_git_path() -> String {
    if let Ok(lock) = ACTIVE_GIT_PATH.read() {
        if let Some(ref p) = *lock {
            let trimmed = p.trim();
            if !trimmed.is_empty() && trimmed != "system" {
                return trimmed.to_string();
            }
        }
    }
    "git".to_string()
}

pub struct CmdResult {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub code: Option<i32>,
}

pub fn run_git(repo_path: &str, args: &[&str]) -> Result<CmdResult, String> {
    let git_bin = get_active_git_path();
    let mut cmd = Command::new(&git_bin);
    cmd.current_dir(repo_path);
    cmd.args(args);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output: Output = cmd.output().map_err(|e| {
        format!("Failed to execute git {:?} in {}: {}", args, repo_path, e)
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(CmdResult {
        stdout,
        stderr,
        success: output.status.success(),
        code: output.status.code(),
    })
}

pub fn run_git_strict(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let res = run_git(repo_path, args)?;
    if !res.success {
        let err_msg = if !res.stderr.trim().is_empty() {
            res.stderr.trim().to_string()
        } else {
            res.stdout.trim().to_string()
        };
        return Err(format!("git {:?} failed: {}", args, err_msg));
    }
    Ok(res.stdout)
}

pub fn resolve_ref(repo_path: &str, r: &str) -> Result<(String, String), String> {
    let trimmed = r.trim();
    if trimmed.is_empty() {
        return Err("Cannot resolve empty reference".to_string());
    }

    // 1. Try exact ref first (e.g. "feat/x", "HEAD", "origin/main", commit hash)
    if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", trimmed]) {
        return Ok((out.trim().to_string(), trimmed.to_string()));
    }

    // 2. If ref does not start with origin/ or refs/, try origin/<ref>
    if !trimmed.starts_with("origin/") && !trimmed.starts_with("refs/") {
        let origin_ref = format!("origin/{}", trimmed);
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", &origin_ref]) {
            return Ok((out.trim().to_string(), origin_ref));
        }

        let remotes_ref = format!("remotes/origin/{}", trimmed);
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", &remotes_ref]) {
            return Ok((out.trim().to_string(), remotes_ref));
        }
    }

    // 3. If ref starts with origin/, try stripped local ref
    if let Some(stripped) = trimmed.strip_prefix("origin/") {
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", stripped]) {
            return Ok((out.trim().to_string(), stripped.to_string()));
        }
    }

    // 4. If ref was "main" or "master", try fallback to the other
    if trimmed == "main" || trimmed == "origin/main" {
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", "master"]) {
            return Ok((out.trim().to_string(), "master".to_string()));
        }
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", "origin/master"]) {
            return Ok((out.trim().to_string(), "origin/master".to_string()));
        }
    } else if trimmed == "master" || trimmed == "origin/master" {
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", "main"]) {
            return Ok((out.trim().to_string(), "main".to_string()));
        }
        if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", "origin/main"]) {
            return Ok((out.trim().to_string(), "origin/main".to_string()));
        }
    }

    // 5. Try HEAD as ultimate fallback
    if let Ok(out) = run_git_strict(repo_path, &["rev-parse", "--short", "HEAD"]) {
        return Ok((out.trim().to_string(), "HEAD".to_string()));
    }

    // 6. Fail with original error message from git
    let out = run_git_strict(repo_path, &["rev-parse", "--short", trimmed])?;
    Ok((out.trim().to_string(), trimmed.to_string()))
}
