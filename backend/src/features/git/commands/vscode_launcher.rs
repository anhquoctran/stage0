use std::path::Path;
use std::process::Command;

pub enum VsCodeTarget<'a> {
    Repo(&'a Path),
    File {
        path: &'a Path,
        line: Option<i64>,
    },
}

impl<'a> VsCodeTarget<'a> {
    #[cfg(target_os = "windows")]
    fn to_windows_args(&self) -> Vec<String> {
        match self {
            VsCodeTarget::Repo(path) => {
                let win_path = path.to_string_lossy().replace('/', "\\");
                vec![win_path]
            }
            VsCodeTarget::File { path, line } => {
                let win_path = path.to_string_lossy().replace('/', "\\");
                let target_str = match line {
                    Some(l) if *l > 0 => format!("{}:{}", win_path, l),
                    _ => win_path,
                };
                vec!["-g".to_string(), target_str]
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn to_cli_args(&self) -> Vec<String> {
        match self {
            VsCodeTarget::Repo(path) => {
                vec![path.to_string_lossy().to_string()]
            }
            VsCodeTarget::File { path, line } => {
                let base_str = path.to_string_lossy().to_string();
                let target_str = match line {
                    Some(l) if *l > 0 => format!("{}:{}", base_str, l),
                    _ => base_str,
                };
                vec!["-g".to_string(), target_str]
            }
        }
    }

    #[cfg(target_os = "macos")]
    fn to_mac_open_path(&self) -> String {
        match self {
            VsCodeTarget::Repo(path) => path.to_string_lossy().to_string(),
            VsCodeTarget::File { path, .. } => path.to_string_lossy().to_string(),
        }
    }
}

#[cfg(target_os = "windows")]
pub fn launch_vscode(target: VsCodeTarget) -> Result<(), String> {
    let args = target.to_windows_args();

    let mut candidates = Vec::new();
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(
            std::path::PathBuf::from(&local_appdata)
                .join("Programs\\Microsoft VS Code\\Code.exe"),
        );
        candidates.push(
            std::path::PathBuf::from(&local_appdata)
                .join("Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe"),
        );
    }
    if let Ok(prog_files) = std::env::var("PROGRAMFILES") {
        candidates.push(
            std::path::PathBuf::from(&prog_files)
                .join("Microsoft VS Code\\Code.exe"),
        );
        candidates.push(
            std::path::PathBuf::from(&prog_files)
                .join("Microsoft VS Code Insiders\\Code - Insiders.exe"),
        );
    }
    if let Ok(prog_x86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(
            std::path::PathBuf::from(&prog_x86)
                .join("Microsoft VS Code\\Code.exe"),
        );
    }

    for cand in candidates {
        if cand.exists() && Command::new(&cand).args(&args).spawn().is_ok() {
            return Ok(());
        }
    }

    for cli_cmd in ["code.cmd", "code.exe", "code", "code-insiders.cmd", "code-insiders.exe"] {
        if Command::new(cli_cmd).args(&args).spawn().is_ok() {
            return Ok(());
        }
    }

    Err("Visual Studio Code is not installed or not configured in system PATH. Please ensure VS Code is installed and 'code' is available in your PATH.".to_string())
}

#[cfg(target_os = "macos")]
pub fn launch_vscode(target: VsCodeTarget) -> Result<(), String> {
    let cli_args = target.to_cli_args();

    let mut candidates = Vec::new();

    // 1. Pinned app bundle CLI binaries inside standard macOS install locations
    candidates.push(std::path::PathBuf::from(
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    ));
    candidates.push(std::path::PathBuf::from(
        "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
    ));
    candidates.push(std::path::PathBuf::from(
        "/Applications/VSCodium.app/Contents/Resources/app/bin/codium",
    ));

    if let Ok(home) = std::env::var("HOME") {
        let home_path = std::path::PathBuf::from(home);
        candidates.push(home_path.join(
            "Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        ));
        candidates.push(home_path.join(
            "Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
        ));
        candidates.push(home_path.join(
            "Applications/VSCodium.app/Contents/Resources/app/bin/codium",
        ));
    }

    // 2. Homebrew and standard CLI paths
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/code"));
    candidates.push(std::path::PathBuf::from("/usr/local/bin/code"));
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/code-insiders"));
    candidates.push(std::path::PathBuf::from("/usr/local/bin/code-insiders"));
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/codium"));
    candidates.push(std::path::PathBuf::from("/usr/local/bin/codium"));

    // Try explicit path candidates first (these support -g line jumping)
    for cand in candidates {
        if cand.exists() && Command::new(&cand).args(&cli_args).spawn().is_ok() {
            return Ok(());
        }
    }

    // Try commands in current PATH
    for cli_cmd in ["code", "code-insiders", "codium"] {
        if Command::new(cli_cmd).args(&cli_args).spawn().is_ok() {
            return Ok(());
        }
    }

    // 3. Fall back to macOS LaunchServices 'open' command
    let mac_target = target.to_mac_open_path();
    let bundle_ids = [
        "com.microsoft.VSCode",
        "com.microsoft.VSCodeInsiders",
        "com.vscodium",
    ];
    for bundle_id in bundle_ids {
        if let Ok(status) = Command::new("open")
            .args(["-b", bundle_id, &mac_target])
            .status()
        {
            if status.success() {
                return Ok(());
            }
        }
    }

    let app_names = [
        "Visual Studio Code",
        "Visual Studio Code - Insiders",
        "VSCodium",
    ];
    for app_name in app_names {
        if let Ok(status) = Command::new("open")
            .args(["-a", app_name, &mac_target])
            .status()
        {
            if status.success() {
                return Ok(());
            }
        }
    }

    Err("Visual Studio Code is not installed or not found in /Applications. Please install VS Code or run 'Shell Command: Install code command in PATH' from VS Code Command Palette.".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn launch_vscode(target: VsCodeTarget) -> Result<(), String> {
    let cli_args = target.to_cli_args();

    let mut candidates = vec![
        std::path::PathBuf::from("/usr/bin/code"),
        std::path::PathBuf::from("/usr/local/bin/code"),
        std::path::PathBuf::from("/bin/code"),
        std::path::PathBuf::from("/snap/bin/code"),
        std::path::PathBuf::from("/var/lib/snapd/snap/bin/code"),
        std::path::PathBuf::from("/usr/bin/code-insiders"),
        std::path::PathBuf::from("/snap/bin/code-insiders"),
        std::path::PathBuf::from("/usr/bin/codium"),
        std::path::PathBuf::from("/snap/bin/codium"),
        std::path::PathBuf::from("/opt/visual-studio-code/bin/code"),
        std::path::PathBuf::from("/opt/visual-studio-code/code"),
    ];

    if let Ok(home) = std::env::var("HOME") {
        let home_path = std::path::PathBuf::from(home);
        candidates.push(home_path.join(".local/bin/code"));
        candidates.push(home_path.join(".local/bin/code-insiders"));
        candidates.push(home_path.join(".local/bin/codium"));
    }

    for cand in candidates {
        if cand.exists() && Command::new(&cand).args(&cli_args).spawn().is_ok() {
            return Ok(());
        }
    }

    for cli_cmd in ["code", "code-insiders", "codium"] {
        if Command::new(cli_cmd).args(&cli_args).spawn().is_ok() {
            return Ok(());
        }
    }

    // Try Flatpak (Flathub packages: com.visualstudio.code, com.vscodium.codium)
    for flatpak_app in ["com.visualstudio.code", "com.vscodium.codium"] {
        let mut flatpak_args = vec!["run".to_string(), flatpak_app.to_string()];
        flatpak_args.extend(cli_args.clone());
        if Command::new("flatpak").args(&flatpak_args).spawn().is_ok() {
            return Ok(());
        }
    }

    Err("Visual Studio Code is not installed or not found in PATH, Snap, or Flatpak. Please ensure VS Code is installed and available.".to_string())
}

