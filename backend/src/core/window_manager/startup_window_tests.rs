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

#[cfg(target_os = "linux")]
#[test]
#[ignore = "requires a Linux desktop session for native GTK decoration checks"]
fn wayland_splash_handoff_restores_native_controls_and_tracks_window_title() {
    use gtk::prelude::*;

    gtk::init().expect("GTK requires a desktop session");
    let window = gtk::Window::new(gtk::WindowType::Toplevel);
    let placeholder = gtk::EventBox::new();
    window.set_title("Stage0 splash");
    window.set_titlebar(Some(&placeholder));
    window.set_decorated(false);
    window.show_all();
    window.hide();
    window.set_decorated(true);
    assert!(
        placeholder.child().is_none(),
        "decorations alone leave the empty splash title bar"
    );

    super::startup_window::restore_system_titlebar(&window);
    let header = placeholder
        .child()
        .unwrap()
        .downcast::<gtk::HeaderBar>()
        .unwrap();
    header.set_decoration_layout(Some(":minimize,maximize,close"));
    window.show_all();
    fn native_buttons(widget: &gtk::Widget, buttons: &mut Vec<&'static str>) {
        for name in ["minimize", "maximize", "close"] {
            if widget.style_context().has_class(name) {
                buttons.push(name);
            }
        }
        if let Some(container) = widget.downcast_ref::<gtk::Container>() {
            container.forall(|child| native_buttons(child, buttons));
        }
    }
    let mut buttons = Vec::new();
    native_buttons(header.upcast_ref(), &mut buttons);
    assert_eq!(buttons, ["minimize", "maximize", "close"]);
    window.set_title("Stage0 — repository");
    assert_eq!(header.title().as_deref(), Some("Stage0 — repository"));

    super::startup_window::restore_system_titlebar(&window);
    assert_eq!(
        placeholder.child(),
        Some(header.upcast()),
        "repeated handoffs must not duplicate controls"
    );
    window.close();

    let standard = gtk::Window::new(gtk::WindowType::Toplevel);
    super::startup_window::restore_system_titlebar(&standard);
    assert!(
        standard.titlebar().is_none(),
        "standard system frames must remain toolkit-owned"
    );
    standard.close();
}
