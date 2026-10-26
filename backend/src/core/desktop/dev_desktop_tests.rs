use super::{register, ICON};
use gtk::gio;
use gtk::gio::prelude::AppInfoExt;
use std::path::Path;

#[test]
fn dev_launcher_has_its_own_identity_and_official_icon_without_overwriting_release() {
    let data = tempfile::tempdir().unwrap();
    let applications = data.path().join("applications");
    std::fs::create_dir_all(&applications).unwrap();
    let release = applications.join("Stage0.desktop");
    std::fs::write(&release, "installed application").unwrap();
    register(
        data.path(),
        "com.stage0.app.dev",
        "Stage0",
        Path::new("/tmp/stage0"),
    )
    .unwrap();

    let desktop = applications.join("com.stage0.app.dev.desktop");
    let app = gio::DesktopAppInfo::from_filename(&desktop).unwrap();
    assert_eq!(app.name(), "Stage0 (Development)");
    assert_eq!(
        app.startup_wm_class().as_deref(),
        Some("com.stage0.app.dev")
    );
    assert_eq!(
        std::fs::read_to_string(&release).unwrap(),
        "installed application"
    );
    let icon = data
        .path()
        .join("icons/hicolor/512x512/apps/com.stage0.app.dev.png");
    assert_eq!(std::fs::read(&icon).unwrap(), ICON);
    assert_eq!(app.string("Icon").unwrap().as_str(), icon.to_str().unwrap());

    let modified = std::fs::metadata(&desktop).unwrap().modified().unwrap();
    register(
        data.path(),
        "com.stage0.app.dev",
        "Stage0",
        Path::new("/tmp/stage0"),
    )
    .unwrap();
    assert_eq!(
        std::fs::metadata(&desktop).unwrap().modified().unwrap(),
        modified
    );
}

#[test]
fn gio_launches_the_exact_executable_path_with_spaces_and_reserved_characters() {
    use std::os::unix::fs::PermissionsExt;

    let data = tempfile::tempdir().unwrap();
    let directory = data
        .path()
        .join("space \" quote $ dollar ` tick \\ slash %f field");
    std::fs::create_dir(&directory).unwrap();
    let executable = directory.join("stage0 probe");
    let output = directory.join("started");
    std::fs::write(
        &executable,
        "#!/bin/sh\nprintf started > \"$(dirname \"$0\")/started\"\n",
    )
    .unwrap();
    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
    register(data.path(), "com.stage0.app.dev", "Stage0", &executable).unwrap();
    let app = gio::DesktopAppInfo::from_filename(
        data.path().join("applications/com.stage0.app.dev.desktop"),
    )
    .unwrap();
    app.launch(&[], None::<&gio::AppLaunchContext>).unwrap();
    for _ in 0..100 {
        if output.exists() {
            assert_eq!(std::fs::read_to_string(&output).unwrap(), "started");
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    panic!("GIO did not execute the exact development binary path");
}
