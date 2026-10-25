#[cfg(target_os = "macos")]
mod macos {
    use std::sync::Mutex;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject, Sel};
    use objc2::{define_class, msg_send, sel, AnyThread, ClassType, MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::{NSApplication, NSMenu, NSMenuItem};
    use objc2_foundation::{ns_string, NSInteger, NSObject};
    use tauri::AppHandle;

    use crate::core::window_manager::{create_welcome_window, open_repo_path};
    use crate::features::git::RepoInfo;

    static DOCK_REPOSITORIES: Mutex<Vec<RepoInfo>> = Mutex::new(Vec::new());
    static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);
    static TARGET: Mutex<Option<Retained<Stage0DockTarget>>> = Mutex::new(None);

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "Stage0DockTarget"]
        #[thread_kind = AnyThread]
        struct Stage0DockTarget;

        impl Stage0DockTarget {
            #[unsafe(method(onNewWindow:))]
            fn on_new_window(&self, _sender: &NSMenuItem) {
                if let Ok(guard) = APP_HANDLE.lock() {
                    if let Some(app) = guard.as_ref() {
                        if let Err(error) = create_welcome_window(app) {
                            eprintln!("Failed to create new window from dock: {error}");
                        }
                    }
                }
            }

            #[unsafe(method(onOpenRepo:))]
            fn on_open_repo(&self, sender: &NSMenuItem) {
                let tag = sender.tag();
                if tag < 0 {
                    return;
                }
                let local_path = {
                    let guard = DOCK_REPOSITORIES.lock().unwrap();
                    guard.get(tag as usize).map(|r| r.local_path.clone())
                };
                if let Some(path) = local_path {
                    if let Ok(guard) = APP_HANDLE.lock() {
                        if let Some(app) = guard.as_ref() {
                            if let Err(error) = open_repo_path(app, &path, None, false) {
                                eprintln!("Failed to open repo from dock: {error}");
                            }
                        }
                    }
                }
            }
        }
    );

    unsafe extern "C" fn application_dock_menu_imp(
        _this: *mut AnyObject,
        _cmd: Sel,
        _sender: *mut AnyObject,
    ) -> *mut AnyObject {
        let Some(mtm) = MainThreadMarker::new() else {
            return std::ptr::null_mut();
        };

        let target_guard = TARGET.lock().unwrap();
        let Some(target) = target_guard.as_ref() else {
            return std::ptr::null_mut();
        };

        let menu = NSMenu::initWithTitle(NSMenu::alloc(mtm), ns_string!("DockMenu"));

        let new_win_title = ns_string!("New Window");
        let new_win_item = NSMenuItem::initWithTitle_action_keyEquivalent(
            NSMenuItem::alloc(mtm),
            &new_win_title,
            Some(sel!(onNewWindow:)),
            ns_string!(""),
        );
        new_win_item.setTarget(Some(&**target));
        menu.addItem(&new_win_item);

        menu.addItem(&NSMenuItem::separatorItem(mtm));

        let repos = DOCK_REPOSITORIES.lock().unwrap();
        if repos.is_empty() {
            let empty_title = ns_string!("No Recent Repositories");
            let empty_item = NSMenuItem::initWithTitle_action_keyEquivalent(
                NSMenuItem::alloc(mtm),
                &empty_title,
                None,
                ns_string!(""),
            );
            empty_item.setEnabled(false);
            menu.addItem(&empty_item);
        } else {
            for (index, repo) in repos.iter().take(10).enumerate() {
                let repo_title = objc2_foundation::NSString::from_str(&repo.name);
                let item = NSMenuItem::initWithTitle_action_keyEquivalent(
                    NSMenuItem::alloc(mtm),
                    &repo_title,
                    Some(sel!(onOpenRepo:)),
                    ns_string!(""),
                );
                item.setTarget(Some(&**target));
                item.setTag(index as NSInteger);
                menu.addItem(&item);
            }
        }

        Retained::autorelease_return(menu) as *mut AnyObject
    }

    pub fn setup_dock_menu(app: &AppHandle, repositories: &[RepoInfo]) {
        *APP_HANDLE.lock().unwrap() = Some(app.clone());
        *DOCK_REPOSITORIES.lock().unwrap() = repositories.to_vec();

        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };

        let target = Stage0DockTarget::alloc().set_ivars(());
        let target: Retained<Stage0DockTarget> = unsafe { msg_send![super(target, NSObject::class()), init] };
        *TARGET.lock().unwrap() = Some(target);

        unsafe {
            let ns_app = NSApplication::sharedApplication(mtm);
            let delegate: *mut AnyObject = msg_send![&ns_app, delegate];
            if delegate.is_null() {
                return;
            }
            let cls: *mut AnyClass = msg_send![delegate, class];
            if cls.is_null() {
                return;
            }

            extern "C" {
                fn class_addMethod(
                    cls: *mut AnyClass,
                    name: Sel,
                    imp: unsafe extern "C" fn(
                        *mut AnyObject,
                        Sel,
                        *mut AnyObject,
                    ) -> *mut AnyObject,
                    types: *const std::ffi::c_char,
                ) -> bool;
            }

            let types = c"@:@";
            let _ = class_addMethod(
                cls,
                sel!(applicationDockMenu:),
                application_dock_menu_imp,
                types.as_ptr(),
            );
        }
    }

    pub fn update_dock_repositories(repositories: &[RepoInfo]) {
        *DOCK_REPOSITORIES.lock().unwrap() = repositories.to_vec();
    }
}

#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(not(target_os = "macos"))]
pub fn setup_dock_menu(_app: &tauri::AppHandle, _repositories: &[crate::features::git::RepoInfo]) {}

#[cfg(not(target_os = "macos"))]
pub fn update_dock_repositories(_repositories: &[crate::features::git::RepoInfo]) {}
