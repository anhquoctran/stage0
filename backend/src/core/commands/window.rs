use crate::core::window_manager::{default_window_size, minimum_window_size, WindowManagerState};
use tauri::{AppHandle, Manager, WebviewWindow, Window};

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    let result: Result<_, String> = async { window.minimize().map_err(|e| e.to_string()) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn open_webview_devtools(window: WebviewWindow) -> Result<(), String> {
    let result: Result<_, String> = async {
        window.open_devtools();
        Ok(())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_toggle_maximize(window: Window) -> Result<bool, String> {
    let result: Result<_, String> = async {
        let manager = window.app_handle().state::<WindowManagerState>();
        if let Some(maximized) = manager.startup_geometry(window.label()) {
            manager.defer_startup_geometry(window.label(), !maximized);
            return Ok(!maximized);
        }
        let is_max = window.is_maximized().map_err(|e| e.to_string())?;
        if is_max {
            window.unmaximize().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.maximize().map_err(|e| e.to_string())?;
            Ok(true)
        }
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_toggle_fullscreen(window: Window) -> Result<bool, String> {
    let result: Result<_, String> = async {
        let is_fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
        let next = !is_fullscreen;
        window
            .set_fullscreen(next)
            .map_err(|error| error.to_string())?;
        Ok(next)
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    let result: Result<_, String> = async { window.close().map_err(|e| e.to_string()) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_is_maximized(window: Window) -> Result<bool, String> {
    let result: Result<_, String> =
        async { window.is_maximized().map_err(|e| e.to_string()) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    let result: Result<_, String> =
        async { window.is_fullscreen().map_err(|e| e.to_string()) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), String> {
    let result: Result<_, String> =
        async { crate::core::window_manager::startup_window::request_maximize(&window) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_reset_size(window: Window) -> Result<(), String> {
    let result: Result<_, String> = async {
        if window
            .app_handle()
            .state::<WindowManagerState>()
            .defer_startup_geometry(window.label(), false)
        {
            return Ok(());
        }
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
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_prepare_main(window: Window) -> Result<(), String> {
    let result: Result<_, String> =
        async { crate::core::window_manager::startup_window::prepare_main_window(&window) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_show(window: Window) -> Result<(), String> {
    let result: Result<_, String> = async {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_focus();
        Ok(())
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    let result: Result<_, String> = async {
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
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

/// Desktop settings are read on a worker; a missing desktop tool uses safe defaults.
#[tauri::command]
pub async fn get_window_chrome(
    window: Window,
) -> Result<crate::core::desktop::WindowChrome, String> {
    let result: Result<_, String> = async {
        let mut profile = tauri::async_runtime::spawn_blocking(crate::core::desktop::read_profile)
            .await
            .map_err(|_| crate::common::messages::failure("backend.window.readDesktopSettingsFailed", serde_json::json!({}), "Could not read desktop window settings".into()))?;
        profile.native_frame = if window
            .app_handle()
            .state::<WindowManagerState>()
            .startup_geometry(window.label())
            .is_some()
        {
            crate::core::desktop::desired_system_frame(&window)
        } else if cfg!(target_os = "linux") {
            window.is_decorated().map_err(|error| error.to_string())?
        } else {
            false
        };
        Ok(profile)
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}

#[tauri::command]
pub async fn window_start_dragging(window: Window) -> Result<(), String> {
    let result: Result<_, String> =
        async { window.start_dragging().map_err(|error| error.to_string()) }.await;
    result.map_err(|error| crate::common::messages::command_error("operation", error))
}
