use sha2::{Digest, Sha256};
use std::io;

/// Only used when a new installation key is created. Persisting the derived key
/// in the OS vault keeps later hardware changes from invalidating a readable DB.
pub(super) fn machine_fingerprint() -> io::Result<Vec<u8>> {
    let identity = platform_identity()?;
    Ok(
        Sha256::digest(format!("com.stage0.app/database/machine/v1/{identity}").as_bytes())
            .to_vec(),
    )
}

fn valid_identity(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    let compact: String = normalized.chars().filter(|ch| *ch != '-').collect();
    if compact.len() != 32
        || !compact.bytes().all(|byte| byte.is_ascii_hexdigit())
        || compact.bytes().all(|byte| byte == b'0')
        || compact.bytes().all(|byte| byte == b'f')
    {
        return None;
    }
    Some(compact)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn run_identity_command(command: &mut std::process::Command) -> io::Result<String> {
    let output = crate::common::process::run_bounded_command(
        command,
        16 * 1024,
        1024,
        std::time::Duration::from_secs(5),
    )
    .map_err(|_| identity_error())?;
    if !output.status.success() || output.output_truncated {
        return Err(identity_error());
    }
    String::from_utf8(output.stdout).map_err(|_| identity_error())
}

#[cfg(target_os = "macos")]
fn platform_identity() -> io::Result<String> {
    let output = run_identity_command(std::process::Command::new("/usr/sbin/ioreg").args([
        "-rd1",
        "-c",
        "IOPlatformExpertDevice",
    ]))?;
    output
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once('=')?;
            name.contains("\"IOPlatformUUID\"")
                .then(|| valid_identity(value.trim().trim_matches('"')))
                .flatten()
        })
        .ok_or_else(identity_error)
}

#[cfg(target_os = "windows")]
fn platform_identity() -> io::Result<String> {
    let system = std::env::var_os("SystemRoot")
        .map(std::path::PathBuf::from)
        .filter(|root| root.is_absolute())
        .ok_or_else(identity_error)?;
    let powershell = system.join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let hardware = run_identity_command(std::process::Command::new(powershell).args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction Stop).UUID",
    ]));
    if let Ok(output) = hardware {
        if let Some(identity) = output.lines().find_map(valid_identity) {
            return Ok(identity);
        }
    }
    // Firmware UUID access is not available on every machine. MachineGuid is
    // installation-scoped and still mixed with an independent random secret.
    let output = run_identity_command(
        std::process::Command::new(system.join("System32/reg.exe")).args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
            "/reg:64",
        ]),
    )?;
    output
        .lines()
        .find_map(|line| {
            let mut fields = line.split_whitespace();
            (fields.next()? == "MachineGuid").then_some(())?;
            (fields.next()? == "REG_SZ").then_some(())?;
            valid_identity(fields.next()?)
        })
        .ok_or_else(identity_error)
}

#[cfg(target_os = "linux")]
fn platform_identity() -> io::Result<String> {
    use std::io::Read;
    for path in [
        "/sys/class/dmi/id/product_uuid",
        "/etc/machine-id",
        "/var/lib/dbus/machine-id",
    ] {
        if let Ok(file) = std::fs::File::open(path) {
            let mut value = String::new();
            if file.take(257).read_to_string(&mut value).is_ok() {
                if let Some(identity) = valid_identity(&value) {
                    return Ok(identity);
                }
            }
        }
    }
    Err(identity_error())
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn platform_identity() -> io::Result<String> {
    Err(identity_error())
}

fn identity_error() -> io::Error {
    io::Error::other("Could not obtain a stable machine identifier to create the database key")
}
