use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE, REG_EXPAND_SZ,
    REG_OPTION_NON_VOLATILE, REG_SZ,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE,
};

const STATE_MARKER: &str = "Stage0 managed PATH state v1";
const TARGET_MARKER: &str = "# Stage0 managed CLI target v1";
const SCRIPT_MARKER: &str = "# Stage0 managed CLI launcher v1";
const CMD_MARKER: &str = "rem Stage0 managed CLI launcher v1";
const REGISTRY_ENVIRONMENT: &str = r"Environment";

struct PathState {
    added_entry: bool,
    had_path_value: bool,
}

pub(super) fn apply(enable: bool) -> Result<(), String> {
    let local_app_data = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or("The current user's Local AppData directory is unavailable")?;
    let launcher_dir = local_app_data.join("Stage0/cli");
    if enable {
        enable_path(&launcher_dir)
    } else {
        disable_path(&launcher_dir)
    }
}

fn enable_path(launcher_dir: &Path) -> Result<(), String> {
    let executable = env::current_exe()
        .map_err(|error| error.to_string())?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let executable = executable.to_str().ok_or_else(|| {
        crate::common::messages::code("backend.preferences.executablePathNotUnicode")
    })?;
    if executable.contains('\n') || executable.contains('\r') {
        return Err(crate::common::messages::code(
            "backend.preferences.executablePathLineBreak",
        ));
    }
    fs::create_dir_all(launcher_dir).map_err(|error| {
        crate::common::messages::failure(
            "backend.preferences.createDirFailed",
            serde_json::json!({ "path": launcher_dir.display().to_string() }),
            format!("Could not create {}: {error}", launcher_dir.display()),
        )
    })?;
    write_launcher_files(launcher_dir, executable)?;

    let state_path = launcher_dir.join("path-state.txt");
    let previous_state = read_state(&state_path)?;
    let (current, current_type, had_path_value) = read_user_path()?;
    let already_in_path = contains_path(&current, launcher_dir);
    let added_entry = if already_in_path {
        previous_state
            .as_ref()
            .is_some_and(|state| state.added_entry)
    } else {
        true
    };
    let state = PathState {
        added_entry,
        had_path_value: previous_state
            .as_ref()
            .map_or(had_path_value, |state| state.had_path_value),
    };
    write_state(&state_path, &state)?;

    if !already_in_path {
        let mut entries = current
            .split(';')
            .filter(|entry| !entry.is_empty())
            .map(str::to_owned)
            .collect::<Vec<_>>();
        entries.push(launcher_dir.to_string_lossy().into_owned());
        let updated = entries.join(";");
        if let Err(error) = write_user_path(&updated, current_type) {
            let _ = fs::remove_file(&state_path);
            return Err(error);
        }
        broadcast_environment_change();
    }
    Ok(())
}

fn disable_path(launcher_dir: &Path) -> Result<(), String> {
    let state_path = launcher_dir.join("path-state.txt");
    if let Some(state) = read_state(&state_path)? {
        if state.added_entry {
            let (current, current_type, _) = read_user_path()?;
            let updated = remove_path(&current, launcher_dir);
            if updated != current {
                if updated.is_empty() && !state.had_path_value {
                    delete_user_path()?;
                } else {
                    write_user_path(&updated, current_type)?;
                }
                broadcast_environment_change();
            }
        }
        fs::remove_file(&state_path).map_err(|error| {
            crate::common::messages::failure(
                "backend.preferences.removeFileFailed",
                serde_json::json!({ "path": state_path.display().to_string() }),
                format!("Could not remove {}: {error}", state_path.display()),
            )
        })?;
    }
    remove_managed_file(&launcher_dir.join("stage0.cmd"), CMD_MARKER)?;
    remove_managed_file(&launcher_dir.join("stage0.ps1"), SCRIPT_MARKER)?;
    remove_managed_file(&launcher_dir.join("stage0-target.txt"), TARGET_MARKER)?;
    Ok(())
}

fn write_launcher_files(directory: &Path, executable: &str) -> Result<(), String> {
    let target = directory.join("stage0-target.txt");
    write_managed_file(
        &target,
        TARGET_MARKER,
        format!("{TARGET_MARKER}\n{executable}\n").as_bytes(),
    )?;
    let script = directory.join("stage0.ps1");
    write_managed_file(
        &script,
        SCRIPT_MARKER,
        format!("{SCRIPT_MARKER}\n$target = [System.IO.File]::ReadAllLines((Join-Path $PSScriptRoot 'stage0-target.txt'))[-1]\n& $target @args\n").as_bytes(),
    )?;
    let command = directory.join("stage0.cmd");
    write_managed_file(
        &command,
        CMD_MARKER,
        format!("@echo off\n{CMD_MARKER}\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%~dp0stage0.ps1\" %*\n").as_bytes(),
    )
}

fn write_managed_file(path: &Path, marker: &str, content: &[u8]) -> Result<(), String> {
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(format!(
            "A symbolic link already exists at {} and was left untouched",
            path.display()
        ));
    }
    match fs::read_to_string(path) {
        Ok(existing) if existing.lines().any(|line| line == marker) => {}
        Ok(_) => {
            return Err(format!(
                "A file already exists at {} and was left untouched",
                path.display()
            ))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("Could not inspect {}: {error}", path.display())),
    }
    fs::write(path, content).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn remove_managed_file(path: &Path, marker: &str) -> Result<(), String> {
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Ok(());
    }
    let existing = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect {}: {error}", path.display())),
    };
    if existing.lines().any(|line| line == marker) {
        fs::remove_file(path)
            .map_err(|error| format!("Could not remove {}: {error}", path.display()))?;
    }
    Ok(())
}

fn read_state(path: &Path) -> Result<Option<PathState>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err(format!(
                "A symbolic link exists at {} and was left untouched",
                path.display()
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not inspect {}: {error}", path.display())),
    }
    let content = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not read {}: {error}", path.display())),
    };
    let mut lines = content.lines();
    if lines.next() != Some(STATE_MARKER) {
        return Err(format!(
            "Stage0 PATH state in {} is unrecognized",
            path.display()
        ));
    }
    let added_entry = parse_bool(lines.next(), path)?;
    let had_path_value = parse_bool(lines.next(), path)?;
    Ok(Some(PathState {
        added_entry,
        had_path_value,
    }))
}

fn parse_bool(value: Option<&str>, path: &Path) -> Result<bool, String> {
    match value {
        Some("true") => Ok(true),
        Some("false") => Ok(false),
        _ => Err(format!(
            "Stage0 PATH state in {} is invalid",
            path.display()
        )),
    }
}

fn write_state(path: &Path, state: &PathState) -> Result<(), String> {
    if fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(format!(
            "A symbolic link exists at {} and was left untouched",
            path.display()
        ));
    }
    let content = format!(
        "{STATE_MARKER}\n{}\n{}\n",
        state.added_entry, state.had_path_value
    );
    fs::write(path, content).map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn contains_path(path_value: &str, path: &Path) -> bool {
    let target = path.to_string_lossy();
    path_value
        .split(';')
        .any(|entry| normalize_entry(entry).eq_ignore_ascii_case(&normalize_entry(&target)))
}

fn remove_path(path_value: &str, path: &Path) -> String {
    let target = path.to_string_lossy();
    path_value
        .split(';')
        .filter(|entry| {
            !entry.is_empty()
                && !normalize_entry(entry).eq_ignore_ascii_case(&normalize_entry(&target))
        })
        .collect::<Vec<_>>()
        .join(";")
}

fn normalize_entry(entry: &str) -> String {
    entry
        .trim()
        .trim_matches('"')
        .trim_end_matches(|character| character == '\\' || character == '/')
        .to_owned()
}

fn registry_path() -> Vec<u16> {
    REGISTRY_ENVIRONMENT
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect()
}

fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

fn read_user_path() -> Result<(String, u32, bool), String> {
    let key_path = registry_path();
    let value_name = wide_null("Path");
    unsafe {
        let mut key: HKEY = std::ptr::null_mut();
        let status = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            key_path.as_ptr(),
            0,
            KEY_QUERY_VALUE,
            &mut key,
        );
        if status == ERROR_FILE_NOT_FOUND {
            return Ok((String::new(), REG_EXPAND_SZ, false));
        }
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not read the current-user environment registry key: {status}"
            ));
        }
        let mut value_type = 0;
        let mut byte_count = 0;
        let query = RegQueryValueExW(
            key,
            value_name.as_ptr(),
            std::ptr::null(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut byte_count,
        );
        if query == ERROR_FILE_NOT_FOUND {
            RegCloseKey(key);
            return Ok((String::new(), REG_EXPAND_SZ, false));
        }
        if query != ERROR_SUCCESS || !matches!(value_type, REG_SZ | REG_EXPAND_SZ) {
            RegCloseKey(key);
            return Err("The current-user PATH registry value is not a supported string".into());
        }
        let mut value = vec![0u16; byte_count as usize / std::mem::size_of::<u16>() + 1];
        let query = RegQueryValueExW(
            key,
            value_name.as_ptr(),
            std::ptr::null(),
            &mut value_type,
            value.as_mut_ptr().cast(),
            &mut byte_count,
        );
        RegCloseKey(key);
        if query != ERROR_SUCCESS {
            return Err(format!(
                "Could not read the current-user PATH registry value: {query}"
            ));
        }
        let length = value
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(value.len());
        let text = String::from_utf16(&value[..length])
            .map_err(|error| format!("The current-user PATH is not valid Unicode: {error}"))?;
        Ok((text, value_type, true))
    }
}

fn write_user_path(value: &str, value_type: u32) -> Result<(), String> {
    let key_path = registry_path();
    let value_name = wide_null("Path");
    let data = wide_null(value);
    unsafe {
        let mut key: HKEY = std::ptr::null_mut();
        let status = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            key_path.as_ptr(),
            0,
            std::ptr::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_QUERY_VALUE | KEY_SET_VALUE,
            std::ptr::null(),
            &mut key,
            std::ptr::null_mut(),
        );
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not open the current-user environment registry key: {status}"
            ));
        }
        let bytes = (data.len() * std::mem::size_of::<u16>()) as u32;
        let status = RegSetValueExW(
            key,
            value_name.as_ptr(),
            0,
            value_type,
            data.as_ptr().cast(),
            bytes,
        );
        RegCloseKey(key);
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not update the current-user PATH registry value: {status}"
            ));
        }
    }
    Ok(())
}

fn delete_user_path() -> Result<(), String> {
    let key_path = registry_path();
    let value_name = wide_null("Path");
    unsafe {
        let mut key: HKEY = std::ptr::null_mut();
        let status = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            key_path.as_ptr(),
            0,
            KEY_SET_VALUE,
            &mut key,
        );
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(());
        }
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not open the current-user environment registry key: {status}"
            ));
        }
        let status = RegDeleteValueW(key, value_name.as_ptr());
        RegCloseKey(key);
        if status != ERROR_SUCCESS && status != ERROR_FILE_NOT_FOUND {
            return Err(format!(
                "Could not remove the current-user PATH value: {status}"
            ));
        }
    }
    Ok(())
}

fn broadcast_environment_change() {
    let section = wide_null("Environment");
    unsafe {
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            section.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5_000,
            std::ptr::null_mut(),
        );
    }
}
