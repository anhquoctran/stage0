use std::path::{Path, PathBuf};

/// Use the build's architecture, not the host or a silently emulated fallback.
pub fn registry_target(os: &str, arch: &str) -> Option<String> {
    let os = match os {
        "macos" => "darwin",
        "windows" | "linux" => os,
        _ => return None,
    };
    // Keep other Rust architectures addressable if the Registry adds packages
    // for them (e.g. x86, arm or riscv64); never install an incompatible binary.
    Some(format!("{os}-{arch}"))
}

pub fn current_target() -> Option<String> {
    registry_target(std::env::consts::OS, std::env::consts::ARCH)
}

/// Interpret archive paths identically on every host; reject Windows special
/// paths even on Unix so the same package cannot become unsafe on Windows.
pub fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let normalized = value.replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.chars().any(char::is_control)
    {
        return Err("ACP package contains an unsafe path".into());
    }
    let mut result = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        let device = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        if part == ".."
            || part.contains(':')
            || part.ends_with(['.', ' '])
            || matches!(device.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || ((device.starts_with("COM") || device.starts_with("LPT"))
                && device.len() == 4
                && device.as_bytes()[3].is_ascii_digit())
        {
            return Err("ACP package contains an unsafe path".into());
        }
        result.push(part);
    }
    Ok(result)
}

pub fn relative_command(value: &str, target: &str) -> Result<PathBuf, String> {
    let path = safe_relative_path(value)?;
    if path.as_os_str().is_empty()
        || (target.starts_with("windows-") && !is_windows_executable(&path))
    {
        return Err(crate::common::messages::code(
            "backend.acp.archiveLaunchCommandInvalid",
        ));
    }
    Ok(path)
}

pub fn is_windows_executable(path: &Path) -> bool {
    path.extension()
        .and_then(|part| part.to_str())
        .is_some_and(|part| part.eq_ignore_ascii_case("exe"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn covers_all_desktop_platforms_and_build_architectures_without_fallback() {
        for (os, prefix) in [
            ("macos", "darwin"),
            ("windows", "windows"),
            ("linux", "linux"),
        ] {
            for arch in [
                "x86_64",
                "aarch64",
                "x86",
                "arm",
                "riscv64",
                "loongarch64",
                "powerpc64",
                "s390x",
            ] {
                assert_eq!(registry_target(os, arch), Some(format!("{prefix}-{arch}")));
            }
        }
        assert_eq!(registry_target("unknown", "aarch64"), None);
    }

    #[test]
    fn allows_unix_par_nested_binaries_and_windows_exe_but_never_escape_paths() {
        assert_eq!(
            relative_command("./agy_acp_server.par", "darwin-aarch64").unwrap(),
            PathBuf::from("agy_acp_server.par")
        );
        assert_eq!(
            relative_command("./folder/bin/agent", "linux-x86_64").unwrap(),
            PathBuf::from("folder/bin/agent")
        );
        assert_eq!(
            relative_command(".\\bin\\agent.exe", "windows-aarch64").unwrap(),
            PathBuf::from("bin").join("agent.exe")
        );
        assert!(relative_command("agent.cmd", "windows-x86_64").is_err());
        for path in [
            "../agent",
            "x/../agent",
            "/agent",
            "C:\\agent.exe",
            "\\\\host\\agent",
            "foo:bar",
            "NUL",
            "con.txt",
            "dir./agent",
            "agent\n",
        ] {
            assert!(safe_relative_path(path).is_err(), "{path}");
        }
    }
}
