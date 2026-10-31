use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

const BEGIN: &str = "# >>> Stage0 CLI PATH >>>";
const END: &str = "# <<< Stage0 CLI PATH <<<";
const LAUNCHER_MARKER: &str = "# Stage0 managed CLI launcher v1";

pub(super) fn apply(enable: bool) -> Result<(), String> {
    let Some(home) = home_dir() else {
        return if enable {
            Err(crate::common::messages::code(
                "backend.preferences.userHomeUnavailable",
            ))
        } else {
            Ok(())
        };
    };
    let launcher = home.join(".local/bin/stage0");
    if enable {
        install(&home, &launcher)
    } else {
        remove_path_blocks(&home)?;
        remove_launcher(&launcher)
    }
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .filter(|home| home.is_absolute())
}

fn target_executable() -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    if let Some(appimage) = env::var_os("APPIMAGE") {
        let path = PathBuf::from(appimage);
        if path.is_file() {
            return path.canonicalize().map_err(|error| error.to_string());
        }
    }

    let executable = env::current_exe().map_err(|error| error.to_string())?;
    executable.canonicalize().map_err(|error| error.to_string())
}

fn install(home: &Path, launcher: &Path) -> Result<(), String> {
    let target = target_executable()?;
    let target = target.to_str().ok_or_else(|| {
        crate::common::messages::code("backend.preferences.executablePathNotUtf8")
    })?;
    if target.contains('\n') || target.contains('\r') {
        return Err(crate::common::messages::code(
            "backend.preferences.executablePathLineBreak",
        ));
    }
    let script = format!(
        "#!/bin/sh\n{LAUNCHER_MARKER}\nexec {} \"$@\"\n",
        shell_quote(target)
    );
    write_managed_launcher(launcher, script.as_bytes())?;

    let mut updated = Vec::new();
    for (path, block) in startup_files(home) {
        match add_path_block(&path, block) {
            Ok(true) => updated.push(path),
            Ok(false) => {}
            Err(error) => {
                for changed in updated {
                    let _ = remove_path_block(&changed);
                }
                return Err(error);
            }
        }
    }
    Ok(())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn startup_files(home: &Path) -> Vec<(PathBuf, &'static str)> {
    let shell = env::var_os("SHELL")
        .and_then(|value| PathBuf::from(value).file_name().map(|name| name.to_owned()))
        .and_then(|name| name.into_string().ok())
        .unwrap_or_else(|| {
            if cfg!(target_os = "macos") {
                "zsh".into()
            } else {
                "bash".into()
            }
        });

    match shell.as_str() {
        "zsh" => vec![
            (home.join(".zprofile"), POSIX_BLOCK),
            (home.join(".zshrc"), POSIX_BLOCK),
        ],
        "fish" => vec![(home.join(".config/fish/config.fish"), FISH_BLOCK)],
        "bash" => {
            let login = [".bash_profile", ".bash_login", ".profile"]
                .into_iter()
                .map(|file| home.join(file))
                .find(|path| path.exists())
                .unwrap_or_else(|| home.join(".profile"));
            vec![(login, POSIX_BLOCK), (home.join(".bashrc"), POSIX_BLOCK)]
        }
        _ => vec![(home.join(".profile"), POSIX_BLOCK)],
    }
}

const POSIX_BLOCK: &str = "# >>> Stage0 CLI PATH >>>\ncase \":$PATH:\" in\n  *:\"$HOME/.local/bin\":*) ;;\n  *) export PATH=\"$HOME/.local/bin:$PATH\" ;;\nesac\n# <<< Stage0 CLI PATH <<<";
const FISH_BLOCK: &str = "# >>> Stage0 CLI PATH >>>\nif not contains -- \"$HOME/.local/bin\" $PATH\n  set -gx PATH \"$HOME/.local/bin\" $PATH\nend\n# <<< Stage0 CLI PATH <<<";

fn add_path_block(path: &Path, block: &str) -> Result<bool, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            crate::common::messages::failure(
                "backend.preferences.createDirFailed",
                serde_json::json!({ "path": parent.display().to_string() }),
                format!("Could not create {}: {error}", parent.display()),
            )
        })?;
    }
    let current = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => {
            return Err(crate::common::messages::failure(
                "backend.preferences.readConfigFailed",
                serde_json::json!({ "path": path.display().to_string() }),
                format!("Could not read {}: {error}", path.display()),
            ));
        }
    };
    let has_begin = current.contains(BEGIN);
    let has_end = current.contains(END);
    if has_begin && has_end {
        return Ok(false);
    }
    if has_begin || has_end {
        return Err(crate::common::messages::failure(
            "backend.preferences.pathBlockIncomplete",
            serde_json::json!({ "path": path.display().to_string() }),
            format!("Stage0 PATH block in {} is incomplete", path.display()),
        ));
    }

    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options.open(path).map_err(|error| {
        crate::common::messages::failure(
            "backend.preferences.updateConfigFailed",
            serde_json::json!({ "path": path.display().to_string() }),
            format!("Could not update {}: {error}", path.display()),
        )
    })?;
    if !current.is_empty() {
        file.write_all(b"\n").map_err(|error| {
            crate::common::messages::failure(
                "backend.preferences.updateConfigFailed",
                serde_json::json!({ "path": path.display().to_string() }),
                format!("Could not update {}: {error}", path.display()),
            )
        })?;
    }
    file.write_all(block.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|error| {
            crate::common::messages::failure(
                "backend.preferences.updateConfigFailed",
                serde_json::json!({ "path": path.display().to_string() }),
                format!("Could not update {}: {error}", path.display()),
            )
        })?;
    Ok(true)
}

fn remove_path_blocks(home: &Path) -> Result<(), String> {
    let paths = [
        home.join(".profile"),
        home.join(".bash_profile"),
        home.join(".bash_login"),
        home.join(".bashrc"),
        home.join(".zprofile"),
        home.join(".zshrc"),
        home.join(".config/fish/config.fish"),
    ];
    for path in paths {
        remove_path_block(&path)?;
    }
    Ok(())
}

fn remove_path_block(path: &Path) -> Result<(), String> {
    let current = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not read {}: {error}", path.display())),
    };
    let Some(start) = current.find(BEGIN) else {
        if current.contains(END) {
            return Err(format!(
                "Stage0 PATH block in {} is incomplete",
                path.display()
            ));
        }
        return Ok(());
    };
    let Some(end_start) = current.find(END) else {
        return Err(format!(
            "Stage0 PATH block in {} is incomplete",
            path.display()
        ));
    };
    if current[start + BEGIN.len()..].contains(BEGIN)
        || current[end_start + END.len()..].contains(END)
        || end_start < start
    {
        return Err(format!(
            "Stage0 PATH block in {} is ambiguous",
            path.display()
        ));
    }
    let block_start = if start > 0 && current.as_bytes()[start - 1] == b'\n' {
        start - 1
    } else {
        start
    };
    let mut block_end = end_start + END.len();
    if current[block_end..].starts_with("\r\n") {
        block_end += 2;
    } else if current[block_end..].starts_with('\n') {
        block_end += 1;
    }
    let mut updated = String::with_capacity(current.len() - (block_end - block_start));
    updated.push_str(&current[..block_start]);
    updated.push_str(&current[block_end..]);
    fs::write(path, updated)
        .map_err(|error| format!("Could not update {}: {error}", path.display()))
}

fn write_managed_launcher(path: &Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(format!(
            "A symbolic link already exists at {} and was left untouched",
            path.display()
        ));
    }
    match fs::read_to_string(path) {
        Ok(existing) if existing.contains(LAUNCHER_MARKER) => {}
        Ok(_) => {
            return Err(format!(
                "A file already exists at {} and was left untouched",
                path.display()
            ))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not inspect {}: {error}", path.display())),
    }
    fs::write(path, content)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755))
        .map_err(|error| format!("Could not make {} executable: {error}", path.display()))
}

fn remove_launcher(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect {}: {error}", path.display())),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Ok(());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
    if content.contains(LAUNCHER_MARKER) {
        fs::remove_file(path)
            .map_err(|error| format!("Could not remove {}: {error}", path.display()))?;
    }
    Ok(())
}
