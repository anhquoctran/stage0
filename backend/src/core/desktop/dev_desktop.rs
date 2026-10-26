//! User-local Dock identity for unbundled Linux development executables.
use std::fs;
use std::path::Path;

const ICON: &[u8] = include_bytes!("../../../icons/icon.png");

pub fn initialize(identifier: &str, product_name: &str) -> Result<(), String> {
    let desktop_id = format!("{identifier}.dev");
    // GTK uses the program name as the Wayland app_id without registering another
    // GtkApplication bus name. Tauri's single-instance argument routing stays intact.
    gtk::glib::set_prgname(Some(&desktop_id));
    gtk::glib::set_application_name(&format!("{product_name} (Development)"));
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    register(
        &gtk::glib::user_data_dir(),
        &desktop_id,
        product_name,
        &executable,
    )
    .map_err(|error| format!("Could not register the Stage0 development Dock icon: {error}"))
}

fn register(
    data_dir: &Path,
    desktop_id: &str,
    product_name: &str,
    executable: &Path,
) -> Result<(), String> {
    let icon = data_dir
        .join("icons/hicolor/512x512/apps")
        .join(format!("{desktop_id}.png"));
    let icon_path = icon
        .to_str()
        .ok_or("The development icon path is not UTF-8")?;
    let executable = executable
        .to_str()
        .ok_or("The development executable path is not UTF-8")?;
    // GIO checks the first Exec token before expanding field codes. Use env so
    // a percent in the checkout path is decoded only when passing the argument.
    let entry = format!(
        "[Desktop Entry]\nType=Application\nName={} (Development)\nExec=/usr/bin/env -- {}\nIcon={}\nStartupWMClass={}\nTerminal=false\nCategories=Development;\nX-Stage0-Dev=true\n",
        entry_value(product_name),
        exec_value(executable),
        entry_value(icon_path),
        desktop_id,
    );
    write_if_changed(&icon, ICON)?;
    write_if_changed(
        &data_dir
            .join("applications")
            .join(format!("{desktop_id}.desktop")),
        entry.as_bytes(),
    )
}

fn entry_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn exec_value(executable: &str) -> String {
    let mut quoted = String::from("\"");
    for character in executable.chars() {
        if matches!(character, '\\' | '"' | '$' | '`') {
            quoted.push('\\');
        }
        quoted.push(character);
        if character == '%' {
            quoted.push('%'); // A literal percent must not become an Exec field code.
        }
    }
    quoted.push('"');
    entry_value(&quoted)
}

fn write_if_changed(path: &Path, contents: &[u8]) -> Result<(), String> {
    if fs::read(path).is_ok_and(|existing| existing == contents) {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg(test)]
#[path = "dev_desktop_tests.rs"]
mod tests;
