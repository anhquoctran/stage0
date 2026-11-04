//! Native regressions for the typed FFI paths in CodeQL alerts 14–20.
//! These exercise valid public contracts, not arbitrary/dangling raw pointers.

use glib::{collections::PtrSlice, prelude::*, translate::*, Object};

#[test]
fn object_borrowed_and_owned_conversions_keep_exact_reference_ownership() {
    let object = Object::new::<Object>();
    assert_eq!(object.ref_count(), 1);
    let borrowed: Object = unsafe { from_glib_none(object.as_ptr()) };
    assert_eq!(object.ref_count(), 2);
    let full: *mut glib::gobject_ffi::GObject = object.to_glib_full();
    let owned: Object = unsafe { from_glib_full(full) };
    assert_eq!(owned, object);
    assert_eq!(object.ref_count(), 3);
    drop(borrowed);
    drop(owned);
    assert_eq!(object.ref_count(), 1);
}

#[test]
fn value_copy_and_clear_release_the_payload_once_without_releasing_live_copies() {
    let object = Object::new::<Object>();
    let weak = object.downgrade();
    let value = object.to_value();
    let copy = value.clone();
    drop(object);
    drop(value);
    assert!(weak.upgrade().is_some());
    assert!(copy.get::<Object>().is_ok());
    drop(copy);
    assert!(weak.upgrade().is_none());

    // Exercise boxed GValue ownership as well as the GObject payload above.
    let boxed = glib::Bytes::from_static(b"boxed probe").to_value();
    let copy = boxed.clone();
    drop(boxed);
    assert_eq!(copy.get::<glib::Bytes>().unwrap().as_ref(), b"boxed probe");
}

#[test]
fn truncation_drops_elements_but_keeps_the_pointer_array_live_and_reusable() {
    let first = Object::new::<Object>();
    let first_weak = first.downgrade();
    let second = Object::new::<Object>();
    let second_weak = second.downgrade();
    let mut values: PtrSlice<Object> = vec![first, second].into();
    values.truncate(1);
    assert_eq!(values.len(), 1);
    assert!(second_weak.upgrade().is_none());
    assert_eq!(values[0].type_(), Object::static_type());
    for _ in 0..32 {
        let next = Object::new::<Object>();
        let weak = next.downgrade();
        values.push(next);
        values.truncate(1);
        assert!(weak.upgrade().is_none());
        assert!(first_weak.upgrade().is_some());
    }
    values.truncate(usize::MAX);
    assert_eq!(values.len(), 1);
    values.truncate(0);
    assert!(first_weak.upgrade().is_none());
    assert!(values.is_empty());
    values.push(Object::new::<Object>());
    assert_eq!(values[0].type_(), Object::static_type());
}

#[test]
fn charset_out_parameters_produce_strings_and_uuid_validation_returns_bool() {
    // The reported SARIF paths incorrectly connect these generic conversions
    // to ObjectRef/MyBoxed/Value and LogLevel implementations, respectively.
    let (_, charset): (bool, Option<&glib::GStr>) = glib::charset();
    if let Some(charset) = charset {
        assert!(!charset.as_str().is_empty());
    }
    let console: Option<glib::GString> = glib::console_charset();
    if let Some(charset) = console {
        assert!(!charset.is_empty());
    }
    assert!(glib::uuid_string_is_valid(
        "67b50596-d59a-4785-b92c-7e041ead89d8"
    ));
    assert!(!glib::uuid_string_is_valid("not-a-uuid"));
}

#[cfg(unix)]
#[test]
fn error_out_parameters_and_nullable_uri_hostname_use_their_actual_types() {
    let missing = std::env::temp_dir()
        .join(format!("stage0-missing-{}", glib::uuid_string_random()))
        .join("file");
    for error in [
        glib::file_set_contents(&missing, b"probe").unwrap_err(),
        glib::file_set_contents_full(&missing, b"probe", glib::FileSetContentsFlags::NONE, 0o600)
            .unwrap_err(),
    ] {
        let copy: glib::Error = error.clone();
        drop(error);
        assert!(!copy.message().is_empty());
    }
    assert!(!missing.exists());
    let (path, hostname): (std::path::PathBuf, Option<glib::GString>) =
        glib::filename_from_uri("file:///tmp/stage0-codeql-probe").unwrap();
    assert!(path.ends_with("stage0-codeql-probe"));
    assert!(hostname.is_none());
    assert!(glib::filename_from_uri("not-a-file-uri").is_err());
}
