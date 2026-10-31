use super::{app_webview_url, focus_window, PreferencesWindowState};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WebviewWindowBuilder};

pub const LABEL: &str = "preferences";
pub const OPEN_EVENT: &str = "preferences-window-open";
pub const CLOSE_EVENT: &str = "preferences-window-close-requested";

fn validate_tab(tab: &Option<String>) -> Result<(), String> {
    if tab.as_ref().is_some_and(|value| {
        value.is_empty()
            || value.len() > 100
            || !value
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
    }) {
        return Err(crate::common::messages::code(
            "backend.preferences.invalidSection",
        ));
    }
    Ok(())
}

fn title(language: &str) -> String {
    let label =
        crate::core::menu::localized_menu_label("menu.commands.preferences", language, "macos");
    format!("Stage0 — {}", label.trim_end_matches(['.', '…']))
}

pub fn refresh_title(app: &AppHandle, language: &str) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.set_title(&title(language));
    }
}

fn send_open(window: &WebviewWindow, state: &PreferencesWindowState) -> Result<(), String> {
    window
        .emit_to(
            LABEL,
            OPEN_EVENT,
            serde_json::json!({ "tab": state.take_tab() }),
        )
        .map_err(|error| error.to_string())
}

/// Every caller, including native menu actions, shares this one creation lock.
pub async fn open(app: &AppHandle, tab: Option<String>) -> Result<(), String> {
    validate_tab(&tab)?;
    let state = app.state::<PreferencesWindowState>();
    let _creation = state.creation.lock().await;
    state.request_tab(tab);
    if let Some(window) = app.get_webview_window(LABEL) {
        if state.is_ready() {
            send_open(&window, &state)?;
        }
        return focus_window(&window);
    }
    state.set_ready(false);
    let settings = app
        .state::<crate::features::preferences::PreferencesManager>()
        .read()
        .ok()
        .and_then(|document| document.settings);
    let system_frame = cfg!(target_os = "linux")
        && settings
            .as_ref()
            .and_then(|settings| settings.pointer("/appearance/linuxTitleBar"))
            .and_then(|value| value.as_str())
            != Some("custom");
    let language = settings
        .as_ref()
        .and_then(|settings| settings.pointer("/appearance/language"))
        .and_then(|value| value.as_str())
        .unwrap_or("en");
    let mut builder = WebviewWindowBuilder::new(app, LABEL, app_webview_url(app, "index.html"))
        .title(title(language))
        .inner_size(1100.0, 800.0)
        .min_inner_size(900.0, 620.0)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .decorations(system_frame)
        .shadow(true)
        .visible(false)
        .center();
    #[cfg(target_os = "macos")]
    {
        builder = builder.transparent(true).shadow(false);
    }
    let result = builder
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Started {
                window
                    .app_handle()
                    .state::<PreferencesWindowState>()
                    .set_ready(false);
            }
            if payload.event() == PageLoadEvent::Finished {
                // Bootstrap errors still have a visible, retryable loading surface.
                let _ = focus_window(&window);
            }
        })
        .build();
    match result {
        Ok(window) => {
            #[cfg(target_os = "linux")]
            limit_linux_controls(&window);
            let _ = window;
            Ok(())
        }
        Err(error) => {
            state.destroyed();
            Err(crate::common::messages::failure(
                "backend.preferences.openFailed",
                serde_json::json!({}),
                format!("Could not open Preferences: {error}"),
            ))
        }
    }
}

#[cfg(target_os = "linux")]
fn limit_linux_controls(window: &WebviewWindow) {
    let native_window = window.clone();
    let _ = window.run_on_main_thread(move || {
        use gtk::prelude::{Cast, GtkWindowExt, HeaderBarExt, WidgetExt};

        if let Ok(native) = native_window.gtk_window() {
            // Tauri's minimizable/maximizable flags are unsupported on Linux.
            native.set_type_hint(gtk::gdk::WindowTypeHint::Dialog);
            if let Some(header) = native
                .titlebar()
                .and_then(|bar| bar.downcast::<gtk::HeaderBar>().ok())
            {
                header.set_decoration_layout(Some(":close"));
            }
            if let Some(surface) = WidgetExt::window(&native) {
                surface.set_functions(gtk::gdk::WMFunction::MOVE | gtk::gdk::WMFunction::CLOSE);
            }
        }
    });
}

pub async fn ready(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != LABEL {
        return Err(crate::common::messages::code(
            "backend.preferences.initUnauthorized",
        ));
    }
    let app = window.app_handle();
    let state = app.state::<PreferencesWindowState>();
    let _creation = state.creation.lock().await;
    // The close/open listeners are installed before the frontend calls this.
    send_open(window, &state)?;
    state.set_ready(true);
    focus_window(window)
}

#[cfg(test)]
mod tests;
