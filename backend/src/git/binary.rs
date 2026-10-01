use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
#[cfg(windows)]
use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBinaryInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: String,
    pub source: String, // "system" | "bundled" | "standard" | "homebrew" | "xcode" | "github_desktop" | "scoop" | "custom"
    pub is_valid: bool,
    pub is_active: bool,
}

pub fn test_git_version(path: &str) -> Result<String, String> {
    let mut cmd = Command::new(path);
    cmd.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = crate::process::run_bounded_command(
        &mut cmd,
        64 * 1024,
        64 * 1024,
        std::time::Duration::from_secs(5),
    )
    .map_err(|error| format!("Failed to run Git executable: {}", error))?;
    if output.output_truncated {
        return Err("Git executable produced too much output".to_string());
    }
    if !output.status.success() {
        return Err(format!(
            "Command exited with error code {:?}",
            output.status.code()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.contains("git version") {
        Ok(stdout)
    } else {
        Err(format!("Unexpected output: {}", stdout))
    }
}

pub fn scan_system_git_binaries(
    active_path: Option<&str>,
    active_id: Option<&str>,
) -> Vec<GitBinaryInfo> {
    let mut candidates: Vec<(String, String)> = Vec::new(); // (path, source_hint)
    let mut seen_paths: HashSet<String> = HashSet::new();

    // 1. Default PATH "git"
    candidates.push(("git".to_string(), "system".to_string()));

    // 2. Discover from PATH using OS tool
    #[cfg(windows)]
    {
        let mut cmd = Command::new("where.exe");
        cmd.arg("git");
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = crate::process::run_bounded_command(
            &mut cmd,
            1024 * 1024,
            64 * 1024,
            std::time::Duration::from_secs(5),
        ) {
            if out.status.success() && !out.output_truncated {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && Path::new(trimmed).exists() {
                        candidates.push((trimmed.to_string(), "system".to_string()));
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("which");
        cmd.args(["-a", "git"]);
        if let Ok(out) = crate::process::run_bounded_command(
            &mut cmd,
            1024 * 1024,
            64 * 1024,
            std::time::Duration::from_secs(5),
        ) {
            if out.status.success() && !out.output_truncated {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && Path::new(trimmed).exists() {
                        candidates.push((trimmed.to_string(), "system".to_string()));
                    }
                }
            }
        }
    }

    // 3. Well-known standard installation paths
    #[cfg(windows)]
    {
        let standard_windows_paths = [
            "C:\\Program Files\\Git\\cmd\\git.exe",
            "C:\\Program Files\\Git\\bin\\git.exe",
            "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
            "C:\\Program Files (x86)\\Git\\bin\\git.exe",
            "C:\\ProgramData\\chocolatey\\bin\\git.exe",
        ];
        for p in standard_windows_paths {
            if Path::new(p).exists() {
                candidates.push((p.to_string(), "standard".to_string()));
            }
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let local_path = PathBuf::from(&local_app_data);
            let p1 = local_path.join("Programs\\Git\\cmd\\git.exe");
            if p1.exists() {
                candidates.push((p1.to_string_lossy().to_string(), "standard".to_string()));
            }
            let p2 = local_path.join("Programs\\Git\\bin\\git.exe");
            if p2.exists() {
                candidates.push((p2.to_string_lossy().to_string(), "standard".to_string()));
            }

            // GitHub Desktop on Windows
            let gh_dir = local_path.join("GitHubDesktop");
            if gh_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&gh_dir) {
                    for entry in entries.flatten() {
                        let sub_p = entry.path().join("resources\\app\\git\\cmd\\git.exe");
                        if sub_p.exists() {
                            candidates.push((
                                sub_p.to_string_lossy().to_string(),
                                "github_desktop".to_string(),
                            ));
                        }
                    }
                }
            }
        }

        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let user_path = PathBuf::from(&user_profile);
            let scoop_git = user_path.join("scoop\\apps\\git\\current\\bin\\git.exe");
            if scoop_git.exists() {
                candidates.push((scoop_git.to_string_lossy().to_string(), "scoop".to_string()));
            }
            let scoop_shim = user_path.join("scoop\\shims\\git.exe");
            if scoop_shim.exists() {
                candidates.push((
                    scoop_shim.to_string_lossy().to_string(),
                    "scoop".to_string(),
                ));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let standard_mac_paths = [
            ("/usr/bin/git", "system"),
            ("/opt/homebrew/bin/git", "homebrew"),
            ("/usr/local/bin/git", "homebrew"),
            ("/Library/Developer/CommandLineTools/usr/bin/git", "xcode"),
            (
                "/Applications/Xcode.app/Contents/Developer/usr/bin/git",
                "xcode",
            ),
            (
                "/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git",
                "github_desktop",
            ),
        ];
        for (p, src) in standard_mac_paths {
            if Path::new(p).exists() {
                candidates.push((p.to_string(), src.to_string()));
            }
        }
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let standard_linux_paths = [
            ("/usr/bin/git", "system"),
            ("/usr/local/bin/git", "standard"),
            ("/bin/git", "system"),
            ("/snap/bin/git", "snap"),
        ];
        for (p, src) in standard_linux_paths {
            if Path::new(p).exists() {
                candidates.push((p.to_string(), src.to_string()));
            }
        }
    }

    // 4. Bundled Git check (both working directory and next to current_exe)
    let mut bundled_candidates = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        #[cfg(windows)]
        bundled_candidates.push(current_dir.join("resources\\git\\cmd\\git.exe"));
        #[cfg(not(windows))]
        bundled_candidates.push(current_dir.join("resources/git/bin/git"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            #[cfg(windows)]
            {
                bundled_candidates.push(exe_dir.join("resources\\git\\cmd\\git.exe"));
                bundled_candidates.push(exe_dir.join("git\\cmd\\git.exe"));
            }
            #[cfg(target_os = "macos")]
            {
                bundled_candidates.push(exe_dir.join("../Resources/git/bin/git"));
                bundled_candidates.push(exe_dir.join("resources/git/bin/git"));
            }
            #[cfg(all(not(windows), not(target_os = "macos")))]
            {
                bundled_candidates.push(exe_dir.join("resources/git/bin/git"));
                bundled_candidates.push(exe_dir.join("../lib/stage0/git/bin/git"));
            }
        }
    }

    for bp in bundled_candidates {
        if bp.exists() {
            candidates.push((bp.to_string_lossy().to_string(), "bundled".to_string()));
        }
    }

    // Include the currently saved active path if custom
    if let Some(act) = active_path {
        if !act.trim().is_empty() && act != "git" {
            candidates.push((act.to_string(), "custom".to_string()));
        }
    }

    let mut results: Vec<GitBinaryInfo> = Vec::new();

    let target_id = active_id.unwrap_or("system");
    let target_path = active_path.unwrap_or("git");

    for (raw_path, source) in candidates {
        let norm_key = if raw_path == "git" {
            "git".to_string()
        } else {
            match dunce::canonicalize(&raw_path) {
                Ok(c) => c.to_string_lossy().to_lowercase(),
                Err(_) => raw_path.to_lowercase(),
            }
        };

        if seen_paths.contains(&norm_key) {
            continue;
        }
        seen_paths.insert(norm_key);

        match test_git_version(&raw_path) {
            Ok(version_str) => {
                let id = if raw_path == "git" {
                    "system".to_string()
                } else if source == "bundled" {
                    "bundled".to_string()
                } else {
                    format!("git-{}", results.len() + 1)
                };

                let name = match source.as_str() {
                    "system" => {
                        if raw_path == "git" {
                            "System Git (PATH Default)".to_string()
                        } else {
                            format!("System Git ({})", raw_path)
                        }
                    }
                    "bundled" => "Stage0 Bundled Git".to_string(),
                    "homebrew" => format!("Homebrew Git ({})", raw_path),
                    "xcode" => format!("Apple Xcode Git ({})", raw_path),
                    "github_desktop" => format!("GitHub Desktop Git ({})", raw_path),
                    "scoop" => format!("Scoop Git ({})", raw_path),
                    "custom" => format!("Custom Git ({})", raw_path),
                    _ => format!("Git ({})", raw_path),
                };

                let is_active = (raw_path == target_path) || (id == target_id);

                results.push(GitBinaryInfo {
                    id,
                    name,
                    path: raw_path,
                    version: version_str,
                    source,
                    is_valid: true,
                    is_active,
                });
            }
            Err(e) => {
                if raw_path == "git" {
                    results.push(GitBinaryInfo {
                        id: "system".to_string(),
                        name: "System Git (PATH Default)".to_string(),
                        path: "git".to_string(),
                        version: format!("Error: {}", e),
                        source: "system".to_string(),
                        is_valid: false,
                        is_active: target_id == "system",
                    });
                }
            }
        }
    }

    if !results.is_empty() && !results.iter().any(|r| r.is_active) {
        if let Some(first) = results.first_mut() {
            first.is_active = true;
        }
    }

    results
}
