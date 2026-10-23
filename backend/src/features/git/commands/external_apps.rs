use super::vscode_launcher::{launch_vscode, VsCodeTarget};

#[tauri::command]
pub async fn reveal_file_in_os(repo_path: String, file_path: String) -> Result<(), String> {
    let full_path = crate::features::git::resolve_safe_repo_path(&repo_path, &file_path)?;
    #[cfg(target_os = "windows")]
    {
        let win_path = full_path.to_string_lossy().replace('/', "\\");
        let path_obj = std::path::Path::new(&win_path);
        let arg = if path_obj.exists() {
            format!("/select,{}", win_path)
        } else if let Some(parent) = path_obj.parent() {
            parent.to_string_lossy().to_string()
        } else {
            win_path
        };
        std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| format!("Failed to open file explorer: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&full_path)
            .spawn()
            .map_err(|e| format!("Failed to open in Finder: {}", e))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let target = if full_path.is_file() {
            full_path.parent().unwrap_or(&full_path).to_path_buf()
        } else {
            full_path
        };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn open_repo_in(
    repo_path: String,
    target: String, // "explorer" | "vscode" | "terminal"
) -> Result<(), String> {
    let path = std::path::Path::new(&repo_path);
    if !path.exists() {
        return Err(format!("Repository path does not exist: {}", repo_path));
    }
    let canonical_repo = path
        .canonicalize()
        .map_err(|e| format!("Invalid repository path '{}': {}", repo_path, e))?;

    match target.as_str() {
        "explorer" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = canonical_repo.to_string_lossy().replace('/', "\\");
                std::process::Command::new("explorer")
                    .arg(&win_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open Explorer: {}", e))?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open in Finder: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                std::process::Command::new("xdg-open")
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open file manager: {}", e))?;
                Ok(())
            }
        }
        "vscode" => launch_vscode(VsCodeTarget::Repo(&canonical_repo)),
        "terminal" => {
            #[cfg(target_os = "windows")]
            {
                let win_path = canonical_repo.to_string_lossy().replace('/', "\\");
                let mut launched = false;

                // 1. Try Windows Terminal directly via wt.exe in LOCALAPPDATA
                if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
                    let wt_path = std::path::PathBuf::from(local_appdata)
                        .join("Microsoft\\WindowsApps\\wt.exe");
                    if wt_path.exists()
                        && std::process::Command::new(&wt_path)
                            .args(["-d", &win_path])
                            .spawn()
                            .is_ok()
                    {
                        launched = true;
                    }
                }

                // 2. Try wt command directly
                if !launched
                    && std::process::Command::new("wt.exe")
                        .args(["-d", &win_path])
                        .spawn()
                        .is_ok()
                {
                    launched = true;
                }

                // 3. Fallback: pass the path through the environment so a
                // directory name cannot become PowerShell source code.
                if !launched {
                    std::process::Command::new("powershell.exe")
                        .args([
                            "-NoExit",
                            "-Command",
                            "Set-Location -LiteralPath $env:STAGE0_REPO_PATH",
                        ])
                        .env("STAGE0_REPO_PATH", &win_path)
                        .spawn()
                        .map_err(|e| format!("Failed to launch terminal: {}", e))?;
                }
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .args(&["-a", "Terminal"])
                    .arg(&canonical_repo)
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            {
                let terminals = [
                    "x-terminal-emulator",
                    "gnome-terminal",
                    "konsole",
                    "xfce4-terminal",
                    "alacritty",
                    "kitty",
                    "xterm",
                ];
                let mut launched = false;
                for term in terminals {
                    if std::process::Command::new(term)
                        .current_dir(&canonical_repo)
                        .spawn()
                        .is_ok()
                    {
                        launched = true;
                        break;
                    }
                }
                if !launched {
                    return Err("No supported terminal emulator found".to_string());
                }
                Ok(())
            }
        }
        _ => Err(format!("Unknown target: {}", target)),
    }
}

#[tauri::command]
pub async fn open_file_in_editor(
    repo_path: String,
    file_path: String,
    line_number: Option<i64>,
) -> Result<(), String> {
    let full_path = crate::features::git::resolve_safe_repo_path(&repo_path, &file_path)?;
    launch_vscode(VsCodeTarget::File {
        path: &full_path,
        line: line_number,
    })
}
