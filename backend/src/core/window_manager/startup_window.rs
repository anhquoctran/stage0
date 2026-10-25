//! Native geometry for the compact startup surface and its hidden handoff.
use super::{default_window_size, minimum_window_size, WindowManagerState};
use tauri::{Manager, Window};

pub const SPLASH_WIDTH: f64 = 600.0;
pub const SPLASH_HEIGHT: f64 = 380.0;

pub fn request_maximize(window: &Window) -> Result<(), String> {
    if window
        .app_handle()
        .state::<WindowManagerState>()
        .defer_startup_geometry(window.label(), true)
    {
        return Ok(());
    }
    window.maximize().map_err(|error| error.to_string())
}

/// Called only when frontend data and the ready React tree are available.
/// Keep the window hidden until the frontend removes its startup overlay.
pub fn prepare_main_window(window: &Window) -> Result<(), String> {
    let manager = window.app_handle().state::<WindowManagerState>();
    let Some(maximized) = manager.startup_geometry(window.label()) else {
        return Ok(()); // Reloads and repeated readiness effects preserve user geometry.
    };
    window.hide().map_err(|error| error.to_string())?;
    let result = configure_main_window(window, maximized);
    if result.is_err() {
        // A failed geometry transition must leave a visible, retryable splash.
        let _ = window.unmaximize();
        let _ = window.set_decorations(false);
        let _ = window.set_min_size(None::<tauri::Size>);
        let _ = window.set_size(tauri::LogicalSize::new(SPLASH_WIDTH, SPLASH_HEIGHT));
        let _ = window.set_resizable(false);
        let _ = window.set_maximizable(false);
        let _ = window.center();
        let _ = window.show();
    } else {
        manager.complete_startup(window.label());
    }
    result
}

fn configure_main_window(window: &Window, maximized: bool) -> Result<(), String> {
    window
        .set_resizable(true)
        .map_err(|error| error.to_string())?;
    window
        .set_maximizable(true)
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    window
        .set_decorations(true)
        .map_err(|error| error.to_string())?;
    let (width, height) = default_window_size();
    let (min_width, min_height) = minimum_window_size();
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(min_width, min_height)))
        .map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    if maximized {
        window.maximize().map_err(|error| error.to_string())?;
    }
    Ok(())
}
