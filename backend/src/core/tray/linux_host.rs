//! Avoid libappindicator's X11-only GtkStatusIcon fallback on Wayland.
use gtk::gio;
use gtk::glib::{self, variant::ToVariant};
use gtk::prelude::*;

pub(super) fn available() -> bool {
    let wayland = gtk::gdk::Display::default()
        .is_some_and(|display| display.type_().name() == "GdkWaylandDisplay");
    if !wayland {
        return true;
    }
    let Ok(connection) = gio::bus_get_sync(gio::BusType::Session, None::<&gio::Cancellable>) else {
        return false;
    };
    supported(true, |destination, path, interface, method, parameters| {
        connection
            .call_sync(
                Some(destination),
                path,
                interface,
                method,
                Some(parameters),
                None,
                gio::DBusCallFlags::NO_AUTO_START,
                500,
                None::<&gio::Cancellable>,
            )
            .map_err(|_| ())
    })
}

fn supported(
    wayland: bool,
    mut call: impl FnMut(&str, &str, &str, &str, &glib::Variant) -> Result<glib::Variant, ()>,
) -> bool {
    if !wayland {
        return true;
    }
    let owner = call(
        "org.freedesktop.DBus",
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus",
        "NameHasOwner",
        &("org.kde.StatusNotifierWatcher",).to_variant(),
    );
    if owner.ok().and_then(|reply| reply.get::<(bool,)>()) != Some((true,)) {
        return false;
    }
    call(
        "org.kde.StatusNotifierWatcher",
        "/StatusNotifierWatcher",
        "org.freedesktop.DBus.Properties",
        "Get",
        &(
            "org.kde.StatusNotifierWatcher",
            "IsStatusNotifierHostRegistered",
        )
            .to_variant(),
    )
    .ok()
    .filter(|reply| reply.type_().as_str() == "(v)")
    .and_then(|reply| reply.get::<(glib::Variant,)>())
    .and_then(|(registered,)| registered.get::<bool>())
    .unwrap_or(false)
}

#[cfg(test)]
#[path = "linux_host_tests.rs"]
mod tests;
