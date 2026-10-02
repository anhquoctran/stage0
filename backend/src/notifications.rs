use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum NotificationLevel {
    Info,
    Success,
    Warning,
    Error,
    Update,
}

impl Default for NotificationLevel {
    fn default() -> Self {
        NotificationLevel::Info
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NotificationAction {
    pub label: String,
    #[serde(alias = "action_type")]
    pub action_type: String,
    pub payload: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotificationPayload {
    pub id: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub level: NotificationLevel,
    pub actions: Option<Vec<NotificationAction>>,
    pub auto_dismiss_ms: Option<u64>,
    pub sound: Option<String>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotificationPermissionState {
    Granted,
    Denied,
    Default,
    NotRequired,
    Unsupported,
}

pub const NOTIFICATION_EVENT: &str = "app-notification";

#[cfg(target_os = "windows")]
fn base64_encode(bytes: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARSET[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARSET[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[cfg(target_os = "windows")]
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "windows")]
pub fn show_windows_native_toast(title: &str, body: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let escaped_title = escape_xml(&title.replace('\n', " "));
    let escaped_body = escape_xml(&body.replace('\n', " "));

    let script = format!(
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;\n\
         [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;\n\
         $ErrorActionPreference = 'Stop';\n\
         $xml = '<toast><visual><binding template=\"ToastGeneric\"><text>{escaped_title}</text><text>{escaped_body}</text></binding></visual><audio src=\"ms-winsoundevent:Notification.Default\" /></toast>';\n\
         $doc = [Windows.Data.Xml.Dom.XmlDocument]::new();\n\
         $doc.LoadXml($xml);\n\
         $toast = [Windows.UI.Notifications.ToastNotification]::new($doc);\n\
         $toast.Priority = [Windows.UI.Notifications.ToastNotificationPriority]::High;\n\
         $shown = $false;\n\
         try {{\n\
             $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.stage0.app');\n\
             $notifier.Show($toast);\n\
             $shown = $true;\n\
         }} catch {{\n\
             try {{\n\
                 $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}}\\WindowsPowerShell\\v1.0\\powershell.exe');\n\
                 $notifier.Show($toast);\n\
                 $shown = $true;\n\
             }} catch {{}}\n\
         }}\n\
         if (-not $shown) {{ exit 1 }}"
    );

    let utf16_bytes: Vec<u8> = script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let encoded = base64_encode(&utf16_bytes);

    use std::time::{Duration, Instant};

    let mut child = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-EncodedCommand",
            &encoded,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| format!("Could not start the Windows notification service: {error}"))?;
    let deadline = Instant::now() + Duration::from_secs(15);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Timed out while sending the native Windows notification".to_string());
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "Could not monitor the Windows notification service: {error}"
                ));
            }
        }
    };
    if status.success() {
        Ok(())
    } else {
        Err("Windows could not enqueue the native notification".to_string())
    }
}

/// Core function to dispatch a push notification cross-platform from Rust backend.
/// - Fires native OS notifications on Windows (WinRT Toast), macOS (Notification Center), and Linux (Freedesktop D-Bus).
/// - Emits Tauri event `app-notification` to all webviews so listeners stay synchronized.
pub fn send_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    // 1. Emit to in-app frontend listeners
    let _ = app.emit(NOTIFICATION_EVENT, &payload);

    // 2. Dispatch OS native push notification
    #[cfg(target_os = "macos")]
    {
        macos_native::send(&payload)
    }

    #[cfg(target_os = "windows")]
    {
        show_windows_native_toast(&payload.title, &payload.body)
    }

    #[cfg(target_os = "linux")]
    {
        let mut notification = notify_rust::Notification::new();
        notification
            .appname("Stage0")
            .summary(&payload.title)
            .body(&payload.body);
        notification
            .show()
            .map(|_| ())
            .map_err(|error| format!("Linux native notification delivery failed: {error}"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = (app, payload);
        Err("Native OS notifications are not supported on this platform".to_string())
    }
}

#[tauri::command]
pub async fn send_push_notification(
    app: AppHandle,
    payload: NotificationPayload,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_notification(&app, payload))
        .await
        .map_err(|error| format!("Native notification task failed: {error}"))?
}

#[tauri::command]
pub async fn get_notification_permission_state() -> Result<NotificationPermissionState, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(macos_native::permission_state)
            .await
            .map_err(|error| format!("Could not read macOS notification permission: {error}"))?
    }
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        Ok(NotificationPermissionState::NotRequired)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(NotificationPermissionState::Unsupported)
    }
}

#[tauri::command]
pub async fn request_notification_permission() -> Result<NotificationPermissionState, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(macos_native::request_permission)
            .await
            .map_err(|error| format!("Could not request macOS notification permission: {error}"))?
    }
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        Ok(NotificationPermissionState::NotRequired)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(NotificationPermissionState::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::{NotificationAction, NotificationPermissionState};

    #[test]
    fn notification_action_accepts_ipc_and_history_casing() {
        let action: NotificationAction = serde_json::from_str(
            r#"{"label":"Open Preferences","actionType":"open_preferences","payload":"notifications"}"#,
        )
        .expect("frontend camelCase payload should deserialize");
        assert_eq!(action.action_type, "open_preferences");

        let legacy_action: NotificationAction = serde_json::from_str(
            r#"{"label":"Open Preferences","action_type":"open_preferences"}"#,
        )
        .expect("legacy snake_case payload should remain accepted");
        let serialized = serde_json::to_value(legacy_action).unwrap();
        assert_eq!(serialized["actionType"], "open_preferences");
    }

    #[test]
    fn permission_states_match_frontend_contract() {
        assert_eq!(
            serde_json::to_string(&NotificationPermissionState::NotRequired).unwrap(),
            "\"not_required\""
        );
    }
}

#[cfg(target_os = "macos")]
mod macos_native {
    use super::{NotificationPayload, NotificationPermissionState};
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{Bool, NSObject, ProtocolObject};
    use objc2::{define_class, msg_send, AnyThread};
    use objc2_foundation::{NSBundle, NSError, NSObjectProtocol, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNAuthorizationStatus, UNMutableNotificationContent,
        UNNotification, UNNotificationPresentationOptions, UNNotificationRequest,
        UNNotificationSettings, UNNotificationSound, UNUserNotificationCenter,
        UNUserNotificationCenterDelegate,
    };
    use std::ptr::NonNull;
    use std::sync::mpsc::sync_channel;
    use std::sync::OnceLock;
    use std::time::Duration;

    const CALLBACK_TIMEOUT: Duration = Duration::from_secs(120);

    fn is_valid_app_bundle(bundle_path: &str, has_bundle_identifier: bool) -> bool {
        bundle_path.trim_end_matches('/').ends_with(".app") && has_bundle_identifier
    }

    fn has_app_bundle() -> bool {
        let bundle = NSBundle::mainBundle();
        let bundle_path = bundle
            .bundleURL()
            .path()
            .map(|path| path.to_string())
            .unwrap_or_default();
        let has_bundle_identifier = bundle
            .bundleIdentifier()
            .is_some_and(|identifier| identifier.length() > 0);

        is_valid_app_bundle(&bundle_path, has_bundle_identifier)
    }

    define_class!(
        // SAFETY: NSObject has no subclassing requirements. The delegate has no
        // instance state and is safe to receive callbacks on any thread.
        #[unsafe(super(NSObject))]
        #[thread_kind = objc2::AnyThread]
        struct NativeNotificationDelegate;

        // SAFETY: NSObjectProtocol has no additional safety requirements.
        unsafe impl NSObjectProtocol for NativeNotificationDelegate {}

        // SAFETY: The optional delegate method signature matches Apple's protocol.
        unsafe impl UNUserNotificationCenterDelegate for NativeNotificationDelegate {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present_notification(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion_handler: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                completion_handler.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List
                    | UNNotificationPresentationOptions::Sound,));
            }
        }
    );

    impl NativeNotificationDelegate {
        fn new() -> Retained<Self> {
            let this = Self::alloc();
            // SAFETY: NSObject's init method is valid for this subclass.
            let this: Retained<Self> = unsafe { msg_send![this, init] };
            this
        }
    }

    fn install_foreground_delegate(center: &UNUserNotificationCenter) {
        static DELEGATE: OnceLock<Retained<NativeNotificationDelegate>> = OnceLock::new();
        let delegate = DELEGATE.get_or_init(NativeNotificationDelegate::new);
        center.setDelegate(Some(ProtocolObject::from_ref(&**delegate)));
    }

    fn native_error_message(operation: &str, error: &NSError) -> String {
        // Domain/code identify an OS failure without exposing NSError userInfo.
        format!(
            "macOS could not {operation} ({} code {})",
            error.domain(),
            error.code()
        )
    }

    pub fn permission_state() -> Result<NotificationPermissionState, String> {
        if !has_app_bundle() {
            return Ok(NotificationPermissionState::Unsupported);
        }

        let (sender, receiver) = sync_channel(1);
        let center = UNUserNotificationCenter::currentNotificationCenter();
        let callback = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
            // SAFETY: UserNotifications passes a live, non-null settings object to this callback.
            let status = unsafe { settings.as_ref() }.authorizationStatus();
            let state = match status {
                UNAuthorizationStatus::Authorized
                | UNAuthorizationStatus::Provisional
                | UNAuthorizationStatus::Ephemeral => NotificationPermissionState::Granted,
                UNAuthorizationStatus::Denied => NotificationPermissionState::Denied,
                UNAuthorizationStatus::NotDetermined => NotificationPermissionState::Default,
                _ => NotificationPermissionState::Unsupported,
            };
            let _ = sender.send(state);
        });
        center.getNotificationSettingsWithCompletionHandler(&callback);
        receiver
            .recv_timeout(CALLBACK_TIMEOUT)
            .map_err(|_| "Timed out reading macOS notification permission".to_string())
    }

    pub fn request_permission() -> Result<NotificationPermissionState, String> {
        match permission_state()? {
            state @ (NotificationPermissionState::Granted
            | NotificationPermissionState::Denied
            | NotificationPermissionState::Unsupported) => return Ok(state),
            NotificationPermissionState::NotRequired => {
                return Ok(NotificationPermissionState::NotRequired)
            }
            NotificationPermissionState::Default => {}
        }

        let (sender, receiver) = sync_channel(1);
        let center = UNUserNotificationCenter::currentNotificationCenter();
        let callback = RcBlock::new(move |granted: Bool, error: *mut NSError| {
            let state = if !error.is_null() {
                // SAFETY: UserNotifications supplies a live NSError during the callback.
                Err(native_error_message(
                    "request notification permission",
                    unsafe { &*error },
                ))
            } else if granted.as_bool() {
                Ok(NotificationPermissionState::Granted)
            } else {
                Ok(NotificationPermissionState::Denied)
            };
            let _ = sender.send(state);
        });
        center.requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &callback,
        );
        receiver
            .recv_timeout(CALLBACK_TIMEOUT)
            .map_err(|_| "Timed out waiting for macOS notification permission".to_string())?
    }

    pub fn send(payload: &NotificationPayload) -> Result<(), String> {
        match permission_state()? {
            NotificationPermissionState::Granted => {}
            NotificationPermissionState::Denied => {
                return Err("macOS notification permission is denied".to_string())
            }
            NotificationPermissionState::Default => {
                return Err("macOS notification permission has not been requested".to_string())
            }
            NotificationPermissionState::NotRequired => {}
            NotificationPermissionState::Unsupported => {
                return Err("macOS native notifications are unavailable".to_string())
            }
        }

        let identifier = NSString::from_str(
            payload
                .id
                .as_deref()
                .unwrap_or("stage0-native-notification"),
        );
        let title = NSString::from_str(&payload.title);
        let body = NSString::from_str(&payload.body);
        let content = UNMutableNotificationContent::new();
        content.setTitle(&title);
        content.setBody(&body);
        content.setSound(Some(&UNNotificationSound::defaultSound()));
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &identifier,
            &content,
            None,
        );

        let (sender, receiver) = sync_channel(1);
        let center = UNUserNotificationCenter::currentNotificationCenter();
        install_foreground_delegate(&center);
        let callback = RcBlock::new(move |error: *mut NSError| {
            let result = if error.is_null() {
                Ok(())
            } else {
                // SAFETY: UserNotifications supplies a live NSError during the callback.
                Err(native_error_message(
                    "send the native notification",
                    unsafe { &*error },
                ))
            };
            let _ = sender.send(result);
        });
        center.addNotificationRequest_withCompletionHandler(&request, Some(&callback));
        receiver
            .recv_timeout(CALLBACK_TIMEOUT)
            .map_err(|_| "Timed out enqueueing the macOS notification".to_string())?
    }

    #[cfg(test)]
    mod tests {
        use super::is_valid_app_bundle;

        #[test]
        fn refuses_unbundled_cargo_executable_path() {
            assert!(!is_valid_app_bundle(
                "/Users/test/stage0/backend/target/debug/",
                true
            ));
        }

        #[test]
        fn accepts_a_proper_app_bundle_with_identifier() {
            assert!(is_valid_app_bundle("/Applications/Stage0.app", true));
            assert!(is_valid_app_bundle("/Applications/Stage0.app/", true));
            assert!(!is_valid_app_bundle("/Applications/Stage0.app", false));
        }
    }
}
