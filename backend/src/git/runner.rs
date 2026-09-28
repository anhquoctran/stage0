use std::process::{Command, Output};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct CmdResult {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub code: Option<i32>,
}

pub fn run_git(repo_path: &str, args: &[&str]) -> Result<CmdResult, String> {
    let mut cmd = Command::new("git");
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
