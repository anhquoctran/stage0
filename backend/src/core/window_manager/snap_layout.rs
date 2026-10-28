use std::sync::mpsc;
use tauri::Window;
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClientRect, HTMAXBUTTON, WM_NCDESTROY, WM_NCHITTEST,
};

const SUBCLASS_ID: usize = 0x5354_4730;
const CONTENT_BORDER: f64 = 1.0;
const TITLE_BAR_HEIGHT: f64 = 34.0;
const WINDOW_BUTTON_WIDTH: f64 = 38.0;

pub(super) fn install_maximize_hit_test(window: &Window) -> Result<(), String> {
    let native_window = window.clone();
    let (sender, receiver) = mpsc::sync_channel(1);
    window
        .run_on_main_thread(move || {
            let result = native_window
                .hwnd()
                .map_err(|error| error.to_string())
                .and_then(|hwnd| {
                    let installed = unsafe {
                        SetWindowSubclass(hwnd, Some(snap_layout_subclass), SUBCLASS_ID, 0)
                    };
                    if installed == 0 {
                        Err(format!(
                            "SetWindowSubclass failed: {}",
                            std::io::Error::last_os_error()
                        ))
                    } else {
                        Ok(())
                    }
                });
            let _ = sender.send(result);
        })
        .map_err(|error| error.to_string())?;
    receiver
        .recv()
        .map_err(|_| "Windows Snap Layout hook did not finish installing".to_string())?
}

unsafe extern "system" fn snap_layout_subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _reference_data: usize,
) -> LRESULT {
    if message == WM_NCHITTEST && unsafe { is_maximize_button(hwnd, lparam) } {
        return HTMAXBUTTON as LRESULT;
    }
    if message == WM_NCDESTROY {
        unsafe { RemoveWindowSubclass(hwnd, Some(snap_layout_subclass), subclass_id) };
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

unsafe fn is_maximize_button(hwnd: HWND, lparam: LPARAM) -> bool {
    let mut client = RECT::default();
    if unsafe { GetClientRect(hwnd, &mut client) } == 0 {
        return false;
    }
    let mut client_origin = POINT { x: 0, y: 0 };
    if unsafe { ClientToScreen(hwnd, &mut client_origin) } == 0 {
        return false;
    }

    let dpi = unsafe { GetDpiForWindow(hwnd) };
    let dpi = if dpi == 0 { 96 } else { dpi };
    let dpi = dpi as f64;
    let scale = dpi / 96.0;
    let packed = lparam as u32;
    let screen_x = (packed as u16 as i16) as i32;
    let screen_y = ((packed >> 16) as u16 as i16) as i32;
    let x = screen_x - client_origin.x;
    let y = screen_y - client_origin.y;
    let client_width = client.right - client.left;
    let border = (CONTENT_BORDER * scale).round() as i32;
    let button_width = (WINDOW_BUTTON_WIDTH * scale).round() as i32;
    let title_bar_height = (TITLE_BAR_HEIGHT * scale).round() as i32;
    let max_button_left = client_width - border - button_width * 2;
    let max_button_right = client_width - border - button_width;

    x >= max_button_left && x < max_button_right && y >= border && y < border + title_bar_height
}
