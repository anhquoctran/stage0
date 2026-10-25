mod window_chrome;
pub use window_chrome::WindowChrome;
#[cfg(any(target_os = "linux", test))]
mod linux;
#[cfg(any(target_os = "linux", test))]
mod parsing;
#[cfg(test)]
mod tests;

use tauri::{Manager, Window};

pub fn uses_system_frame(settings: &serde_json::Value) -> bool {
    system_frame_for(std::env::consts::OS, settings)
}

fn system_frame_for(platform: &str, settings: &serde_json::Value) -> bool {
    platform == "linux"
        && settings
            .pointer("/appearance/linuxTitleBar")
            .and_then(serde_json::Value::as_str)
            != Some("custom")
}

pub fn desired_system_frame(window: &Window) -> bool {
    window
        .app_handle()
        .try_state::<crate::features::preferences::PreferencesManager>()
        .and_then(|manager| manager.read().ok())
        .and_then(|document| document.settings)
        .is_some_and(|settings| uses_system_frame(&settings))
}

pub fn read_profile() -> WindowChrome {
    #[cfg(target_os = "linux")]
    {
        linux::read_profile()
    }
    #[cfg(not(target_os = "linux"))]
    {
        WindowChrome::default()
    }
}
