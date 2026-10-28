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
        .set_decorations(false)
        .map_err(|error| error.to_string())?;
    #[cfg(target_os = "linux")]
    {
        let system_frame = crate::core::desktop::desired_system_frame(window);
        window
            .set_decorations(system_frame)
            .map_err(|error| error.to_string())?;
        if system_frame {
            restore_linux_system_titlebar(window)?;
        }
    }
    let (width, height) = default_window_size();
    let (min_width, min_height) = minimum_window_size();
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(min_width, min_height)))
        .map_err(|error| error.to_string())?;
    // Wayland compositors own window placement and may reject client positioning.
    #[cfg(target_os = "linux")]
    let _ = window.center();
    #[cfg(not(target_os = "linux"))]
    window.center().map_err(|error| error.to_string())?;
    if maximized {
        window.maximize().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn restore_linux_system_titlebar(window: &Window) -> Result<(), String> {
    use gtk::prelude::Cast;

    let native_window = window.clone();
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            let result = native_window.gtk_window().map(|window| {
                restore_system_titlebar(window.upcast_ref());
            });
            let _ = sender.send(result.map_err(|error| error.to_string()));
        })
        .map_err(|error| error.to_string())?;
    receiver
        .recv()
        .map_err(|_| "Could not restore the Linux system title bar".to_string())?
}

#[cfg(target_os = "linux")]
pub(super) fn restore_system_titlebar(window: &gtk::Window) {
    use gtk::prelude::*;

    // Tao leaves an empty EventBox as the CSD title bar for undecorated Wayland
    // windows. Merely enabling decorations preserves it, leaving no native buttons.
    // Fill that placeholder without replacing a realized window's title bar.
    let Some(placeholder) = window
        .titlebar()
        .and_then(|bar| bar.downcast::<gtk::EventBox>().ok())
    else {
        return;
    };
    if placeholder.child().is_some() {
        return;
    }
    let header = gtk::HeaderBar::new();
    header.set_show_close_button(true);
    window
        .bind_property("title", &header, "title")
        .sync_create()
        .build();
    placeholder.add(&header);
    header.show_all();
}
