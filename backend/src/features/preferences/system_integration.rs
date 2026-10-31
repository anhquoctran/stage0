#[cfg(windows)]
mod windows {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteTreeW, RegDeleteValueW, RegOpenKeyExW,
        RegQueryValueExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE,
        KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SZ,
    };

    fn to_wide_null(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn is_launch_at_startup_enabled() -> bool {
        let sub_key = to_wide_null(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let val_name = to_wide_null("Stage0");
        unsafe {
            let mut hkey: HKEY = std::ptr::null_mut();
            if RegOpenKeyExW(
                HKEY_CURRENT_USER,
                sub_key.as_ptr(),
                0,
                KEY_QUERY_VALUE,
                &mut hkey,
            ) == ERROR_SUCCESS
            {
                let status = RegQueryValueExW(
                    hkey,
                    val_name.as_ptr(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                );
                RegCloseKey(hkey);
                status == ERROR_SUCCESS
            } else {
                false
            }
        }
    }

    pub fn update_launch_at_startup(enable: bool, start_in_background: bool) -> Result<(), String> {
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let sub_key = to_wide_null(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let val_name = to_wide_null("Stage0");

        unsafe {
            let mut hkey: HKEY = std::ptr::null_mut();
            if enable {
                let status = RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    sub_key.as_ptr(),
                    0,
                    std::ptr::null_mut(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE,
                    std::ptr::null_mut(),
                    &mut hkey,
                    std::ptr::null_mut(),
                );
                if status != ERROR_SUCCESS {
                    return Err(crate::common::messages::failure(
                        "backend.preferences.openRegistryKeyFailed",
                        serde_json::json!({ "status": status }),
                        format!("Failed to open Run registry key: {status}"),
                    ));
                }
                let command = if start_in_background {
                    format!("\"{}\" --background", exe_path.display())
                } else {
                    format!("\"{}\"", exe_path.display())
                };
                let wide_val = to_wide_null(&command);
                let byte_len = (wide_val.len() * std::mem::size_of::<u16>()) as u32;
                let set_status = RegSetValueExW(
                    hkey,
                    val_name.as_ptr(),
                    0,
                    REG_SZ,
                    wide_val.as_ptr() as *const u8,
                    byte_len,
                );
                RegCloseKey(hkey);
                if set_status != ERROR_SUCCESS {
                    return Err(crate::common::messages::failure(
                        "backend.preferences.setRegistryValueFailed",
                        serde_json::json!({ "status": set_status }),
                        format!("Failed to set Run registry value: {set_status}"),
                    ));
                }
            } else {
                let status = RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    sub_key.as_ptr(),
                    0,
                    KEY_SET_VALUE,
                    &mut hkey,
                );
                if status == ERROR_SUCCESS {
                    let _ = RegDeleteValueW(hkey, val_name.as_ptr());
                    RegCloseKey(hkey);
                }
            }
        }
        Ok(())
    }

    pub fn update_explorer_context_menu(enable: bool) -> Result<(), String> {
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_string_lossy();

        let targets = [
            (
                r"Software\Classes\Directory\shell\Stage0",
                r"Software\Classes\Directory\shell\Stage0\command",
            ),
            (
                r"Software\Classes\Directory\Background\shell\Stage0",
                r"Software\Classes\Directory\Background\shell\Stage0\command",
            ),
        ];

        unsafe {
            for (key_root, key_cmd) in targets {
                let wide_root = to_wide_null(key_root);
                if enable {
                    let mut hkey_root: HKEY = std::ptr::null_mut();
                    let status = RegCreateKeyExW(
                        HKEY_CURRENT_USER,
                        wide_root.as_ptr(),
                        0,
                        std::ptr::null_mut(),
                        REG_OPTION_NON_VOLATILE,
                        KEY_WRITE,
                        std::ptr::null_mut(),
                        &mut hkey_root,
                        std::ptr::null_mut(),
                    );
                    if status == ERROR_SUCCESS {
                        let menu_text = to_wide_null("Open with Stage0");
                        let _ = RegSetValueExW(
                            hkey_root,
                            std::ptr::null(),
                            0,
                            REG_SZ,
                            menu_text.as_ptr() as *const u8,
                            (menu_text.len() * std::mem::size_of::<u16>()) as u32,
                        );

                        let icon_name = to_wide_null("Icon");
                        let icon_val = to_wide_null(&format!("\"{}\"", exe_str));
                        let _ = RegSetValueExW(
                            hkey_root,
                            icon_name.as_ptr(),
                            0,
                            REG_SZ,
                            icon_val.as_ptr() as *const u8,
                            (icon_val.len() * std::mem::size_of::<u16>()) as u32,
                        );

                        RegCloseKey(hkey_root);
                    }

                    let wide_cmd = to_wide_null(key_cmd);
                    let mut hkey_cmd: HKEY = std::ptr::null_mut();
                    let status_cmd = RegCreateKeyExW(
                        HKEY_CURRENT_USER,
                        wide_cmd.as_ptr(),
                        0,
                        std::ptr::null_mut(),
                        REG_OPTION_NON_VOLATILE,
                        KEY_WRITE,
                        std::ptr::null_mut(),
                        &mut hkey_cmd,
                        std::ptr::null_mut(),
                    );
                    if status_cmd == ERROR_SUCCESS {
                        let cmd_val = to_wide_null(&format!("\"{}\" \"%V\"", exe_str));
                        let _ = RegSetValueExW(
                            hkey_cmd,
                            std::ptr::null(),
                            0,
                            REG_SZ,
                            cmd_val.as_ptr() as *const u8,
                            (cmd_val.len() * std::mem::size_of::<u16>()) as u32,
                        );
                        RegCloseKey(hkey_cmd);
                    }
                } else {
                    let _ = RegDeleteTreeW(HKEY_CURRENT_USER, wide_root.as_ptr());
                }
            }
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod non_windows {
    pub fn update_launch_at_startup(
        _enable: bool,
        _start_in_background: bool,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn update_explorer_context_menu(_enable: bool) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(windows)]
use windows::*;

#[cfg(not(windows))]
use non_windows::*;

pub fn apply_system_integration(
    launch_at_startup: Option<bool>,
    start_in_background: Option<bool>,
    explorer_context_menu: Option<bool>,
    add_to_path: Option<bool>,
) {
    if let Some(launch) = launch_at_startup {
        let bg = start_in_background.unwrap_or(false);
        let _ = update_launch_at_startup(launch, bg);
    } else if let Some(bg) = start_in_background {
        #[cfg(windows)]
        {
            if is_launch_at_startup_enabled() {
                let _ = update_launch_at_startup(true, bg);
            }
        }
        #[cfg(not(windows))]
        let _ = bg;
    }

    if let Some(explorer) = explorer_context_menu {
        let _ = update_explorer_context_menu(explorer);
    }

    if let Some(enable) = add_to_path {
        if let Err(error) = cli_path::apply_stage0_path(enable) {
            eprintln!("Could not update Stage0 terminal PATH integration: {error}");
        }
    }
}

mod cli_path;
