use super::super::{NotificationPayload, PermissionState};
use block2::RcBlock;
use core_foundation::{
    base::TCFType,
    url::{CFURLRef, CFURL},
};
use objc2::{rc::Retained, runtime::Bool};
use objc2_foundation::{NSBundle, NSError, NSString};
use objc2_user_notifications::{
    UNAuthorizationOptions, UNAuthorizationStatus, UNMutableNotificationContent,
    UNNotificationRequest, UNNotificationSettings, UNNotificationSound, UNUserNotificationCenter,
};
use std::{ptr::NonNull, sync::mpsc, time::Duration};
use tauri::AppHandle;

#[path = "macos_delegate.rs"]
mod delegate;
pub use delegate::initialize;

#[link(name = "CoreServices", kind = "framework")]
extern "C" {
    fn LSRegisterURL(url: CFURLRef, update: u8) -> i32;
}

fn refresh_bundle_identity() {
    let bundle = NSBundle::mainBundle();
    if bundle.bundleIdentifier().is_none() {
        return;
    }
    let Some(url) = CFURL::from_path(bundle.bundlePath().to_string(), true) else {
        return;
    };
    // Refresh this bundle only. Do not reset Launch Services or notification
    // permissions; installed and development builds keep their existing ID.
    let status = unsafe { LSRegisterURL(url.as_concrete_TypeRef(), 1) };
    if status != 0 {
        eprintln!("Stage0 notification bundle registration failed: OSStatus {status}");
    }
}

fn center() -> Option<Retained<UNUserNotificationCenter>> {
    // Apple's framework raises an ObjC exception for executables without a bundle ID.
    NSBundle::mainBundle().bundleIdentifier()?;
    Some(UNUserNotificationCenter::currentNotificationCenter())
}

pub fn permission(_app: &AppHandle, request: bool) -> Result<PermissionState, String> {
    let Some(center) = center() else {
        return Ok(PermissionState::Unsupported);
    };
    let (tx, rx) = mpsc::sync_channel(1);
    let callback = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
        let status = unsafe { settings.as_ref() }.authorizationStatus();
        let state = match status {
            UNAuthorizationStatus::Authorized
            | UNAuthorizationStatus::Provisional
            | UNAuthorizationStatus::Ephemeral => PermissionState::Granted,
            UNAuthorizationStatus::Denied => PermissionState::Denied,
            UNAuthorizationStatus::NotDetermined => PermissionState::Prompt,
            _ => PermissionState::Unsupported,
        };
        let _ = tx.send(state);
    });
    center.getNotificationSettingsWithCompletionHandler(&callback);
    let state = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?;
    if !request || state != PermissionState::Prompt {
        return Ok(state);
    }
    let (tx, rx) = mpsc::sync_channel(1);
    let callback = RcBlock::new(move |granted: Bool, error: *mut NSError| {
        let state = if !error.is_null() {
            Err(crate::common::messages::code(
                "backend.notifications.dispatchFailed",
            ))
        } else {
            Ok(if granted.as_bool() {
                PermissionState::Granted
            } else {
                PermissionState::Denied
            })
        };
        let _ = tx.send(state);
    });
    center.requestAuthorizationWithOptions_completionHandler(
        UNAuthorizationOptions::Alert
            | UNAuthorizationOptions::Sound
            | UNAuthorizationOptions::Badge,
        &callback,
    );
    rx.recv_timeout(Duration::from_secs(120))
        .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?
}

pub fn send(_app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    let Some(center) = center() else {
        return PermissionState::Unsupported.require_granted();
    };
    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(&payload.title));
    content.setBody(&NSString::from_str(&payload.body));
    content.setSound(Some(&UNNotificationSound::defaultSound()));
    delegate::attach(&center, &content, &payload)?;
    let id = NSString::from_str(
        payload
            .id
            .as_deref()
            .unwrap_or(&uuid::Uuid::new_v4().to_string()),
    );
    let request = UNNotificationRequest::requestWithIdentifier_content_trigger(&id, &content, None);
    let (tx, rx) = mpsc::sync_channel(1);
    let callback = RcBlock::new(move |error: *mut NSError| {
        let _ = tx.send(error.is_null());
    });
    center.addNotificationRequest_withCompletionHandler(&request, Some(&callback));
    if rx.recv_timeout(Duration::from_secs(5)).unwrap_or(false) {
        Ok(())
    } else {
        Err(crate::common::messages::code(
            "backend.notifications.dispatchFailed",
        ))
    }
}
