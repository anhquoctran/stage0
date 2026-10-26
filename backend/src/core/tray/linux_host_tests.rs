use super::supported;
use gtk::glib::{variant::ToVariant, Variant};

#[test]
fn x11_keeps_legacy_trays_without_requiring_a_status_notifier_watcher() {
    assert!(supported(false, |_, _, _, _, _| panic!(
        "X11 must not query SNI"
    )));
}

#[test]
fn wayland_requires_both_a_watcher_and_a_registered_host() {
    for registered in [false, true] {
        let mut calls = Vec::new();
        let available = supported(true, |destination, path, interface, method, arguments| {
            calls.push(method.to_string());
            match method {
                "NameHasOwner" => {
                    assert_eq!(
                        (destination, path, interface),
                        (
                            "org.freedesktop.DBus",
                            "/org/freedesktop/DBus",
                            "org.freedesktop.DBus"
                        )
                    );
                    assert_eq!(
                        arguments.get::<(String,)>(),
                        Some(("org.kde.StatusNotifierWatcher".into(),))
                    );
                    Ok((true,).to_variant())
                }
                "Get" => {
                    assert_eq!(
                        (destination, path, interface),
                        (
                            "org.kde.StatusNotifierWatcher",
                            "/StatusNotifierWatcher",
                            "org.freedesktop.DBus.Properties"
                        )
                    );
                    assert_eq!(
                        arguments.get::<(String, String)>(),
                        Some((
                            "org.kde.StatusNotifierWatcher".into(),
                            "IsStatusNotifierHostRegistered".into()
                        ))
                    );
                    Ok((registered.to_variant(),).to_variant())
                }
                _ => panic!("Unexpected D-Bus method: {method}"),
            }
        });
        assert_eq!(available, registered);
        assert_eq!(calls, ["NameHasOwner", "Get"]);
    }
}

#[test]
fn missing_watchers_bus_errors_and_malformed_replies_do_not_enable_wayland_fallback() {
    for owner in [
        Err(()),
        Ok((false,).to_variant()),
        Ok("invalid".to_variant()),
    ] {
        let mut calls = 0;
        assert!(!supported(true, |_, _, _, method, _| {
            calls += 1;
            assert_eq!(method, "NameHasOwner");
            owner.clone()
        }));
        assert_eq!(calls, 1);
    }
    for host in [
        Err(()),
        Ok((Variant::from("invalid"),).to_variant()),
        Ok((true,).to_variant()),
    ] {
        assert!(!supported(true, |_, _, _, method, _| {
            if method == "NameHasOwner" {
                Ok((true,).to_variant())
            } else {
                host.clone()
            }
        }));
    }
}
