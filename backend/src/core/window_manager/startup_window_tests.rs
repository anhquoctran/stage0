use super::{WindowManagerState, WindowRecord};

#[test]
fn geometry_requests_are_deferred_until_startup_completes() {
    let manager = WindowManagerState::default();
    manager.register_welcome_window("main", true);
    assert_eq!(manager.startup_geometry("main"), Some(false));
    assert!(manager.defer_startup_geometry("main", true));
    assert_eq!(manager.startup_geometry("main"), Some(true));
    assert!(manager.defer_startup_geometry("main", false));
    assert_eq!(manager.startup_geometry("main"), Some(false));
    manager.complete_startup("main");
    assert_eq!(manager.startup_geometry("main"), None);
    assert!(!manager.defer_startup_geometry("main", true));
    manager.register_welcome_window("main", true);
    assert_eq!(
        manager.startup_geometry("main"),
        None,
        "reload cannot reset user geometry"
    );
}

#[test]
fn startup_geometry_is_scoped_to_each_window_and_removed_on_close() {
    let manager = WindowManagerState::default();
    manager.register_welcome_window("main", true);
    manager.register_welcome_window("second", false);
    manager.defer_startup_geometry("main", true);
    assert_eq!(manager.startup_geometry("second"), Some(false));
    assert!(!manager.defer_startup_geometry("notification-host", true));
    manager.unregister_window("main");
    assert_eq!(manager.startup_geometry("main"), None);
    assert_eq!(manager.startup_geometry("second"), Some(false));
}

#[test]
fn new_repository_window_retains_its_maximized_intent_after_open_finishes() {
    let manager = WindowManagerState::default();
    manager.lock().windows.insert(
        "repo".into(),
        WindowRecord {
            repo: None,
            restore_recent: false,
            opening: true,
            startup_maximized: Some(true),
        },
    );
    manager.finish_open("repo");
    assert_eq!(manager.startup_geometry("repo"), Some(true));
    manager.close_repository("repo");
    assert_eq!(manager.startup_geometry("repo"), Some(true));
    manager.defer_startup_geometry("repo", false);
    assert_eq!(manager.startup_geometry("repo"), Some(false));
}
