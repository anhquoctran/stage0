use super::{binary_platform, AcpAgentConfig};
use serde_json::Value;
use std::{path::Path, process::Stdio};
use tokio::process::Command;

pub(super) fn safe_package_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 250
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'@' | b'/' | b'.' | b'_' | b'-' | b'+')
        })
}

pub(super) fn parse_safe_args(value: Option<&Value>) -> Result<Vec<String>, String> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let args = value.as_array().ok_or("ACP Registry args are invalid")?;
    if args.len() > 64 {
        return Err("ACP Registry entry has too many launch arguments".into());
    }
    args.iter()
        .map(|arg| {
            let arg = arg.as_str().ok_or("ACP Registry argument is invalid")?;
            if arg.len() > 1024
                || !arg.bytes().all(|byte| {
                    byte.is_ascii_alphanumeric()
                        || matches!(
                            byte,
                            b'@' | b'/' | b'.' | b'_' | b'-' | b'+' | b':' | b'=' | b','
                        )
                })
            {
                return Err("ACP Registry argument contains unsupported characters".into());
            }
            Ok(arg.to_owned())
        })
        .collect()
}

pub(super) fn validate_config(config: &AcpAgentConfig) -> Result<(), String> {
    if config.id.trim().is_empty()
        || config.id.len() > 100
        || config.name.trim().is_empty()
        || config.name.len() > 200
        || config.args.len() > 64
        || config
            .args
            .iter()
            .any(|arg| arg.len() > 2048 || arg.chars().any(char::is_control))
        || config.command.trim().is_empty()
        || config.command.len() > 512
        || config.command.chars().any(char::is_control)
        || !matches!(config.source.as_str(), "registry" | "custom")
    {
        return Err("Invalid External Agent configuration".into());
    }
    if config
        .launch_mode
        .as_deref()
        .is_some_and(|mode| mode != "binary")
        || (config.launch_mode.as_deref() == Some("binary") && config.source != "registry")
    {
        return Err("Invalid External Agent launch mode".into());
    }
    #[cfg(target_os = "windows")]
    if config.launch_mode.as_deref() != Some("binary")
        && (config.command.chars().any(|ch| {
            matches!(
                ch,
                '&' | '|' | '<' | '>' | '%' | '^' | '!' | '"' | '(' | ')'
            )
        }) || config.args.iter().any(|arg| {
            arg.chars().any(|ch| {
                matches!(
                    ch,
                    '&' | '|' | '<' | '>' | '%' | '^' | '!' | '"' | '(' | ')'
                )
            })
        }))
    {
        return Err("The Windows ACP launcher cannot safely pass shell control characters".into());
    }
    if config.source == "registry" {
        if config.launch_mode.as_deref() == Some("binary") {
            if !Path::new(&config.command).is_absolute()
                || (cfg!(target_os = "windows")
                    && !binary_platform::is_windows_executable(Path::new(&config.command)))
            {
                return Err("ACP Registry binary command must be an absolute executable path (.exe on Windows)".into());
            }
        } else if !matches!(config.command.as_str(), "npx" | "uvx") {
            return Err("Unsupported ACP Registry launch command".into());
        }
    }
    Ok(())
}

pub fn validate_review_agent_config(config: &AcpAgentConfig) -> Result<(), String> {
    validate_config(config)
}

pub fn validate_review_config_overrides(overrides: &Value) -> Result<(), String> {
    let options = overrides
        .as_object()
        .ok_or("ACP reviewer configuration must be an object")?;
    if options.len() > 32 {
        return Err("ACP reviewer configuration contains too many options".into());
    }
    for (id, value) in options {
        if id.is_empty() || id.len() > 128 || id.chars().any(char::is_control) {
            return Err("ACP reviewer configuration contains an invalid option ID".into());
        }
        let valid_value = value.as_bool().is_some()
            || value
                .as_str()
                .is_some_and(|value| value.len() <= 256 && !value.chars().any(char::is_control));
        if !valid_value {
            return Err("ACP reviewer configuration contains an invalid option value".into());
        }
    }
    Ok(())
}

pub(super) fn make_command(config: &AcpAgentConfig, working_directory: Option<&Path>) -> Command {
    #[cfg(target_os = "windows")]
    let mut command = if config.launch_mode.as_deref() == Some("binary") {
        Command::new(&config.command)
    } else {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/D", "/S", "/C", &config.command]);
        cmd
    };
    #[cfg(not(target_os = "windows"))]
    let mut command = Command::new(&config.command);
    if let Some(path) = working_directory {
        command.current_dir(path);
    }
    command
        .args(&config.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    command
}
