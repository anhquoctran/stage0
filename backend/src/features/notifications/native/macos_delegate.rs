use super::super::super::{
    actions::deliver_action_to_user_window, NotificationAction, NotificationPayload,
};
use block2::DynBlock;
use objc2::{define_class, msg_send, rc::Retained, runtime::ProtocolObject, AnyThread};
use objc2_foundation::{NSArray, NSDictionary, NSObject, NSObjectProtocol, NSSet, NSString};
use objc2_user_notifications::{
    UNMutableNotificationContent, UNNotification, UNNotificationAction,
    UNNotificationActionOptions, UNNotificationCategory, UNNotificationCategoryOptions,
    UNNotificationPresentationOptions, UNNotificationResponse, UNUserNotificationCenter,
    UNUserNotificationCenterDelegate,
};
use std::sync::Mutex;
use tauri::AppHandle;

static APP: Mutex<Option<AppHandle>> = Mutex::new(None);
static DELEGATE: Mutex<Option<Retained<Stage0NotificationDelegate>>> = Mutex::new(None);
static CATEGORIES: Mutex<Vec<(String, Vec<NotificationAction>)>> = Mutex::new(Vec::new());

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "Stage0NotificationDelegate"]
    #[thread_kind = AnyThread]
    struct Stage0NotificationDelegate;

    unsafe impl NSObjectProtocol for Stage0NotificationDelegate {}
    unsafe impl UNUserNotificationCenterDelegate for Stage0NotificationDelegate {
        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
        fn will_present(
            &self,
            _center: &UNUserNotificationCenter,
            _notification: &UNNotification,
            complete: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
        ) {
            complete.call((UNNotificationPresentationOptions::Banner
                | UNNotificationPresentationOptions::List
                | UNNotificationPresentationOptions::Sound,));
        }
        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
        fn did_receive(
            &self,
            _center: &UNUserNotificationCenter,
            response: &UNNotificationResponse,
            complete: &DynBlock<dyn Fn()>,
        ) {
            let identifier = response.actionIdentifier().to_string();
            if identifier != "com.apple.UNNotificationDismissActionIdentifier" {
                let data = response.notification().request().content().userInfo();
                if let Some(json) = data
                    .objectForKey(&NSString::from_str("stage0"))
                    .and_then(|value| value.downcast::<NSString>().ok())
                {
                    if let Ok(payload) =
                        serde_json::from_str::<NotificationPayload>(&json.to_string())
                    {
                        let primary_action = payload.primary_action();
                        let action = identifier
                            .strip_prefix("action_")
                            .and_then(|id| id.parse::<usize>().ok())
                            .and_then(|index| payload.actions.as_ref()?.get(index).cloned())
                            .or(Some(primary_action));
                        if let (Some(app), Some(action)) =
                            (APP.lock().ok().and_then(|app| app.clone()), action)
                        {
                            deliver_action_to_user_window(&app, payload.id, action);
                        }
                    }
                }
            }
            complete.call(());
        }
    }
);

pub fn initialize(app: &AppHandle) {
    super::refresh_bundle_identity();
    let Some(center) = super::center() else {
        return;
    };
    if let Ok(mut handle) = APP.lock() {
        *handle = Some(app.clone());
    }
    if let Ok(mut guard) = DELEGATE.lock() {
        let delegate: Retained<Stage0NotificationDelegate> =
            unsafe { msg_send![Stage0NotificationDelegate::alloc(), init] };
        center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        *guard = Some(delegate);
    }
}

pub fn attach(
    center: &UNUserNotificationCenter,
    content: &UNMutableNotificationContent,
    payload: &NotificationPayload,
) -> Result<(), String> {
    let json = NSString::from_str(
        &serde_json::to_string(payload)
            .map_err(|_| crate::common::messages::code("backend.notifications.dispatchFailed"))?,
    );
    let data = NSDictionary::from_slices(&[&*NSString::from_str("stage0")], &[&*json]);
    // NSDictionary generic parameters are erased by Objective-C. Values are property-list strings.
    let data: Retained<NSDictionary> = unsafe { Retained::cast_unchecked(data) };
    unsafe {
        content.setUserInfo(&data);
    }
    let Some(actions) = payload
        .actions
        .as_ref()
        .filter(|actions| !actions.is_empty())
    else {
        return Ok(());
    };
    let id = format!("stage0-{}", uuid::Uuid::new_v4());
    if let Ok(mut categories) = CATEGORIES.lock() {
        if categories.len() >= 100 {
            categories.remove(0);
        }
        categories.push((id.clone(), actions.iter().take(4).cloned().collect()));
        let native_categories: Vec<_> = categories
            .iter()
            .map(|(id, actions)| {
                let native_actions: Vec<_> = actions
                    .iter()
                    .enumerate()
                    .map(|(index, action)| {
                        UNNotificationAction::actionWithIdentifier_title_options(
                            &NSString::from_str(&format!("action_{index}")),
                            &NSString::from_str(&action.label),
                            UNNotificationActionOptions::Foreground,
                        )
                    })
                    .collect();
                UNNotificationCategory::categoryWithIdentifier_actions_intentIdentifiers_options(
                    &NSString::from_str(id),
                    &NSArray::from_retained_slice(&native_actions),
                    &NSArray::new(),
                    UNNotificationCategoryOptions::empty(),
                )
            })
            .collect();
        center.setNotificationCategories(&NSSet::from_retained_slice(&native_categories));
    }
    content.setCategoryIdentifier(&NSString::from_str(&id));
    Ok(())
}
