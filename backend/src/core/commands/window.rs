use crate::core::window_manager::{default_window_size, minimum_window_size};
use tauri::{AppHandle, WebviewWindow, Window};

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_webview_devtools(window: WebviewWindow) -> Result<(), String> {
    window.open_devtools();
    Ok(())
}

#[tauri::command]
pub async fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_is_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_reset_size(window: Window) -> Result<(), String> {
    let _ = window.unmaximize();
    let (min_width, min_height) = minimum_window_size();
    let min_size = tauri::LogicalSize {
        width: min_width,
        height: min_height,
    };
    let (width, height) = default_window_size();
    window
        .set_min_size(Some(tauri::Size::Logical(min_size)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    let _ = window.center();
    Ok(())
}

#[tauri::command]
pub async fn window_show(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe) = std::env::current_exe() {
            let path_str = exe.to_string_lossy();
            if let Some(app_idx) = path_str.find(".app/Contents/MacOS") {
                let bundle_path = &path_str[..app_idx + 4];
                let _ = std::process::Command::new("open")
                    .args(&["-n", bundle_path])
                    .spawn();
            } else {
                let _ = std::process::Command::new(exe).spawn();
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(exe) = std::env::current_exe() {
            let _ = std::process::Command::new(exe).spawn();
        }
    }

    app.exit(0);
    Ok(())
}
