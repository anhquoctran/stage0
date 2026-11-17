//! Keep native window bounds in logical pixels, fitting the monitor work area.
use super::{minimum_window_size, preferences_window, WindowManagerState};
use tauri::{LogicalSize, Manager, PhysicalPosition, Window};

const EDGE_SPACE: f64 = 16.0;

pub(super) struct WindowGeometry {
    pub size: (f64, f64),
    pub minimum: (f64, f64),
    position: Option<PhysicalPosition<i32>>,
}

/// `available` is already converted from physical monitor pixels to logical
/// client pixels, with native decorations excluded. Never scale desired sizes.
pub(super) fn fit_geometry(
    desired: (f64, f64),
    minimum: (f64, f64),
    available: Option<(f64, f64)>,
) -> WindowGeometry {
    let bound = |desired: f64, minimum: f64, available: Option<f64>| {
        let available = available.filter(|value| value.is_finite() && *value > 0.0);
        let limit = available.map(|value| (value - EDGE_SPACE * 2.0).floor().max(1.0));
        let minimum = limit.map_or(minimum, |limit| minimum.min(limit));
        let size = limit
            .map_or(desired, |limit| desired.min(limit))
            .max(minimum);
        (size, minimum)
    };
    let (width, min_width) = bound(desired.0, minimum.0, available.map(|value| value.0));
    let (height, min_height) = bound(desired.1, minimum.1, available.map(|value| value.1));
    WindowGeometry {
        size: (width, height),
        minimum: (min_width, min_height),
        position: None,
    }
}

pub(super) fn window_geometry(
    window: &Window,
    desired: (f64, f64),
    minimum: (f64, f64),
) -> WindowGeometry {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let scale = monitor
        .as_ref()
        .map(|monitor| monitor.scale_factor())
        .filter(|scale| scale.is_finite() && *scale > 0.0)
        .unwrap_or(1.0);
    let frame = window
        .outer_size()
        .ok()
        .zip(window.inner_size().ok())
        .map(|(outer, inner)| {
            (
                outer.width.saturating_sub(inner.width),
                outer.height.saturating_sub(inner.height),
            )
        })
        .unwrap_or((0, 0));
    let available = monitor.as_ref().map(|monitor| {
        let work = monitor.work_area();
        (
            (f64::from(work.size.width) - f64::from(frame.0)) / scale,
            (f64::from(work.size.height) - f64::from(frame.1)) / scale,
        )
    });
    let mut fitted = fit_geometry(desired, minimum, available);
    fitted.position = monitor.map(|monitor| {
        let work = monitor.work_area();
        let width = fitted.size.0 * scale + f64::from(frame.0);
        let height = fitted.size.1 * scale + f64::from(frame.1);
        PhysicalPosition::new(
            work.position.x + ((f64::from(work.size.width) - width) / 2.0).round() as i32,
            work.position.y + ((f64::from(work.size.height) - height) / 2.0).round() as i32,
        )
    });
    fitted
}

impl WindowGeometry {
    pub(super) fn center(&self, window: &Window) -> Result<(), String> {
        let result = if let Some(position) = self.position {
            window.set_position(position)
        } else {
            window.center()
        };
        // Wayland compositors own placement and may reject positioning requests.
        #[cfg(not(target_os = "linux"))]
        result.map_err(|error| error.to_string())?;
        #[cfg(target_os = "linux")]
        let _ = result;
        Ok(())
    }
}

pub fn configure_window(
    window: &Window,
    desired: (f64, f64),
    minimum: (f64, f64),
    center: bool,
) -> Result<(), String> {
    let fitted = window_geometry(window, desired, minimum);
    // Release the previous monitor's minimum before shrinking on a denser display.
    window
        .set_min_size(None::<tauri::Size>)
        .map_err(|error| error.to_string())?;
    window
        .set_min_size(Some(LogicalSize::new(fitted.minimum.0, fitted.minimum.1)))
        .map_err(|error| error.to_string())?;
    let constrained = fitted.size.0 < desired.0 || fitted.size.1 < desired.1;
    let managed = window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false);
    if center || (constrained && !managed) {
        window
            .set_size(LogicalSize::new(fitted.size.0, fitted.size.1))
            .map_err(|error| error.to_string())?;
        fitted.center(window)?;
    }
    Ok(())
}

/// Re-evaluate after the runtime has applied a per-monitor scale transition.
/// Preserve startup geometry and never restore/maximize a user-managed window.
pub fn scale_changed(window: &Window) {
    let manager = window.app_handle().state::<WindowManagerState>();
    if window.label() != preferences_window::LABEL
        && !manager.lock().windows.contains_key(window.label())
    {
        return;
    }
    if manager.startup_geometry(window.label()).is_some() {
        return;
    }
    let window = window.clone();
    // Wry executes run_on_main_thread inline when already on the UI thread.
    // Hop through a worker so this task is queued after Tao's DPI event finishes.
    tauri::async_runtime::spawn(async move {
        let dispatch = window.clone();
        let result = dispatch.run_on_main_thread(move || {
            let Ok(size) = window.inner_size() else {
                return;
            };
            let Ok(scale) = window.scale_factor() else {
                return;
            };
            if !scale.is_finite() || scale <= 0.0 {
                return;
            }
            let logical = size.to_logical::<f64>(scale);
            let minimum = if window.label() == preferences_window::LABEL {
                (900.0, 620.0)
            } else {
                minimum_window_size()
            };
            if let Err(error) =
                configure_window(&window, (logical.width, logical.height), minimum, false)
            {
                eprintln!("Could not fit window to the display work area: {error}");
            }
        });
        if let Err(error) = result {
            eprintln!("Could not queue display geometry refresh: {error}");
        }
    });
}
