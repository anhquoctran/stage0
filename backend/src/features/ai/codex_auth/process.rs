use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    time::Duration,
};

pub struct CodexAuthProcess {
    child: Child,
    input: ChildStdin,
    output: Receiver<Result<Value, String>>,
}

impl CodexAuthProcess {
    pub fn launch(profile: &Path) -> Result<Self, String> {
        let program = find_codex()?;
        Self::spawn(command_for_profile(program, profile))
    }
    pub(super) fn spawn(mut command: Command) -> Result<Self, String> {
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        crate::common::process::configure_process_group(&mut command);
        let mut child = command.spawn().map_err(|_| {
            "Could not start the official Codex executable. Install/update Codex and check PATH."
        })?;
        let input = child.stdin.take().ok_or("Codex stdin is unavailable")?;
        let stdout = child.stdout.take().ok_or("Codex stdout is unavailable")?;
        let (sender, output) = mpsc::sync_channel(16);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut total = 0;
            loop {
                let mut line = Vec::new();
                let result = read_line(&mut reader, &mut line);
                total += line.len();
                let message = match result {
                    Ok(0) => break,
                    Ok(_) if total <= 512 * 1024 => serde_json::from_slice::<Value>(&line)
                        .map_err(|_| "Codex returned invalid auth JSON".to_string()),
                    _ => Err("Codex auth output exceeded limits or was interrupted".into()),
                };
                let failed = message.is_err();
                if sender.try_send(message).is_err() || failed {
                    break;
                }
            }
        });
        Ok(Self {
            child,
            input,
            output,
        })
    }
    pub fn send(&mut self, value: &Value) -> Result<(), String> {
        let bytes = serde_json::to_vec(value).map_err(|_| "Could not encode Codex auth request")?;
        if bytes.len() > 4096 {
            return Err("Codex auth request exceeds limit".into());
        }
        self.input
            .write_all(&bytes)
            .and_then(|_| self.input.write_all(b"\n"))
            .and_then(|_| self.input.flush())
            .map_err(|_| "Codex auth input was interrupted".into())
    }
    pub fn receive(&self, timeout: Duration) -> Result<Option<Value>, String> {
        match self.output.recv_timeout(timeout) {
            Ok(value) => value.map(Some),
            Err(mpsc::RecvTimeoutError::Timeout) => Ok(None),
            Err(_) => Err("Codex auth process stopped. Update Codex or check OS keyring availability; no raw process output was retained.".into()),
        }
    }
}
impl Drop for CodexAuthProcess {
    fn drop(&mut self) {
        crate::common::process::kill_process_tree(&mut self.child);
        let _ = self.child.wait();
    }
}

fn command_for_profile(program: PathBuf, profile: &Path) -> Command {
    let mut command = Command::new(program);
    command.args([
        "-c",
        "cli_auth_credentials_store=\"keyring\"",
        "-c",
        "check_for_update_on_startup=false",
        "app-server",
    ]);
    // Child-only Codex configuration isolates Stage0 credentials. The host
    // environment and the user's global Codex profile are never changed.
    command.env("CODEX_HOME", profile).current_dir(profile);
    for variable in [
        "OPENAI_API_KEY",
        "CODEX_API_KEY",
        "CODEX_ACCESS_TOKEN",
        "OPENAI_BASE_URL",
    ] {
        command.env_remove(variable);
    }
    command
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn launch_configuration_is_auth_only_keyring_only_and_uses_an_isolated_profile() {
        let profile = std::env::temp_dir().join("stage0-fixture-codex-profile");
        let command = command_for_profile("never-executed".into(), &profile);
        assert_eq!(command.get_current_dir(), Some(profile.as_path()));
        let args = command
            .get_args()
            .map(|s| s.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(args.contains(&"app-server".to_string()));
        assert!(args.contains(&"cli_auth_credentials_store=\"keyring\"".to_string()));
        assert!(!args
            .iter()
            .any(|s| s.contains("dangerously") || s == "exec"));
        let env = command
            .get_envs()
            .collect::<std::collections::HashMap<_, _>>();
        for key in [
            "OPENAI_API_KEY",
            "CODEX_API_KEY",
            "CODEX_ACCESS_TOKEN",
            "OPENAI_BASE_URL",
        ] {
            assert_eq!(env.get(std::ffi::OsStr::new(key)), Some(&None));
        }
        assert_eq!(
            env.get(std::ffi::OsStr::new("CODEX_HOME"))
                .copied()
                .flatten(),
            Some(profile.as_os_str())
        );
    }
    #[test]
    fn oversized_auth_lines_fail_without_retaining_the_unbounded_suffix() {
        let mut reader = std::io::Cursor::new(vec![b'x'; 33 * 1024]);
        let mut line = vec![];
        assert!(read_line(&mut reader, &mut line).is_err());
        assert!(line.len() <= 32 * 1024);
    }
}

fn read_line(reader: &mut impl BufRead, line: &mut Vec<u8>) -> Result<usize, String> {
    loop {
        let bytes = reader
            .fill_buf()
            .map_err(|_| "Codex auth pipe interrupted")?;
        if bytes.is_empty() {
            return Ok(line.len());
        }
        let amount = bytes
            .iter()
            .position(|b| *b == b'\n')
            .map(|i| i + 1)
            .unwrap_or(bytes.len());
        if line.len() + amount > 32 * 1024 {
            return Err("Codex auth line exceeds limit".into());
        }
        let ended = bytes[amount - 1] == b'\n';
        line.extend_from_slice(&bytes[..amount]);
        reader.consume(amount);
        if ended {
            return Ok(line.len());
        }
    }
}
fn find_codex() -> Result<PathBuf, String> {
    if let Some(paths) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&paths).filter(|p| p.is_absolute()) {
            #[cfg(windows)]
            let candidate = directory.join("codex.exe");
            #[cfg(not(windows))]
            let candidate = directory.join("codex");
            if let Ok(metadata) = std::fs::metadata(&candidate) {
                if !metadata.is_file() {
                    continue;
                }
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if metadata.permissions().mode() & 0o111 == 0 {
                        continue;
                    }
                }
                return std::fs::canonicalize(candidate)
                    .map_err(|_| "Could not resolve the Codex executable".into());
            }
        }
    }
    Err("Official Codex CLI not found on PATH. Install Codex and restart Stage0. Windows requires a native codex.exe; shell .cmd/.bat wrappers are not launched.".into())
}
