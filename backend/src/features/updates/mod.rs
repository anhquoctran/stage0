mod latest_release;
pub use latest_release::LatestRelease;
mod download_progress;
pub use download_progress::DownloadProgress;
mod verified_installer;
use verified_installer::VerifiedInstaller;
mod download_active_guard;
use download_active_guard::DownloadActiveGuard;
mod install_active_guard;
use install_active_guard::InstallActiveGuard;
mod partial_file_guard;
use partial_file_guard::PartialFileGuard;

use futures_util::StreamExt;
use semver::Version;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;

const UPDATE_API_BASE: &str = "https://downloadcenter.quoctran.space";
const MAX_UPDATE_SIZE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_UPDATE_METADATA_BYTES: usize = 1024 * 1024;
const UPDATE_CHANNELS: [&str; 4] = ["dev", "staging", "beta", "stable"];

static DOWNLOAD_ACTIVE: AtomicBool = AtomicBool::new(false);
static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);
static INSTALL_ACTIVE: AtomicBool = AtomicBool::new(false);
static LAST_VERIFIED_INSTALLER: Mutex<Option<VerifiedInstaller>> = Mutex::new(None);

#[tauri::command]
pub async fn check_for_update(channel: String) -> Result<Option<LatestRelease>, String> {
    let (platform, arch) = native_target()?;
    let current_version = env!("CARGO_PKG_VERSION");
    validate_target(&platform, &arch, &channel, &current_version)?;

    fetch_latest_release(&platform, &arch, &channel, current_version).await
}

async fn fetch_latest_release(
    platform: &str,
    arch: &str,
    channel: &str,
    current_version: &str,
) -> Result<Option<LatestRelease>, String> {
    let client = update_http_client(Duration::from_secs(20))?;
    let response = client
        .get(format!("{UPDATE_API_BASE}/api/latest"))
        .query(&[
            ("platform", platform),
            ("arch", arch),
            ("channel", channel),
            ("currentVersion", current_version),
        ])
        .send()
        .await
        .map_err(|_| "Could not reach the Stage0 update service".to_string())?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "Update service returned HTTP {} while checking for updates",
            response.status()
        ));
    }

    let body = read_limited_response(response).await?;
    let release = serde_json::from_slice::<LatestRelease>(&body)
        .map_err(|_| "Update service returned an invalid release response".to_string())?;

    if !release.has_update {
        return Ok(None);
    }
    if release.platform != platform || release.arch != arch || release.channel != channel {
        return Err(
            "Update service returned an artifact for a different platform or channel".into(),
        );
    }
    validate_release(&release)?;
    let current_version = Version::parse(current_version)
        .map_err(|_| "The current Stage0 version is not valid semantic versioning".to_string())?;
    let latest_version = Version::parse(&release.version)
        .map_err(|_| "The update service returned an invalid semantic version".to_string())?;
    if latest_version <= current_version {
        return Err("The update service marked a non-newer version as an update".into());
    }

    Ok(Some(release))
}

async fn read_limited_response(response: reqwest::Response) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|size| size > MAX_UPDATE_METADATA_BYTES as u64)
    {
        return Err("Update service metadata exceeded the 1 MiB safety limit".into());
    }

    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Could not read update service metadata".to_string())?;
        if body.len().saturating_add(chunk.len()) > MAX_UPDATE_METADATA_BYTES {
            return Err("Update service metadata exceeded the 1 MiB safety limit".into());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    channel: String,
    expected_version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<String, String> {
    if DOWNLOAD_ACTIVE
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("An update download is already in progress".into());
    }
    let _active_guard = DownloadActiveGuard;
    DOWNLOAD_CANCELLED.store(false, Ordering::Release);
    *LAST_VERIFIED_INSTALLER
        .lock()
        .map_err(|_| "Could not prepare the update download".to_string())? = None;

    let (platform, arch) = native_target()?;
    let current_version = env!("CARGO_PKG_VERSION");
    validate_target(&platform, &arch, &channel, current_version)?;
    if !valid_version_token(&expected_version) {
        return Err("Invalid expected update version".into());
    }
    let release = fetch_latest_release(&platform, &arch, &channel, current_version)
        .await?
        .ok_or_else(|| "No newer update is currently available".to_string())?;
    if release.version != expected_version {
        return Err(
            "The published update changed since the last check; check again before downloading"
                .into(),
        );
    }
    validate_release(&release)?;

    let file_name = release.file_name;
    let checksum = release.checksum.ok_or_else(|| {
        "This release has no SHA-256 checksum; installation is blocked".to_string()
    })?;
    let size_bytes = release.size_bytes;
    let parsed_url = reqwest::Url::parse(&release.download_url)
        .map_err(|_| "The update service returned an invalid download URL".to_string())?;
    if DOWNLOAD_CANCELLED.load(Ordering::Acquire) {
        return Err("Update download cancelled".into());
    }

    validate_filename(&file_name)?;
    validate_sha256(&checksum)?;
    if size_bytes.is_some_and(|size| size > MAX_UPDATE_SIZE_BYTES) {
        return Err("The update package exceeds the 2 GiB safety limit".into());
    }
    let client = update_http_client(Duration::from_secs(30 * 60))?;
    let response = send_download_request(client.get(parsed_url)).await?;
    if !response.status().is_success() {
        return Err(format!(
            "Update service returned HTTP {} while downloading the package",
            response.status()
        ));
    }
    if !is_trusted_update_url(response.url()) {
        return Err("The update download redirected outside the trusted service domain".into());
    }

    let content_length = response.content_length();
    if let (Some(expected), Some(actual)) = (size_bytes, content_length) {
        if expected != actual {
            return Err("The update package size does not match the release metadata".into());
        }
    }
    let total_bytes = size_bytes.or(content_length);
    if total_bytes.is_some_and(|size| size > MAX_UPDATE_SIZE_BYTES) {
        return Err("The update package exceeds the 2 GiB safety limit".into());
    }

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|error| format!("Could not locate the Downloads folder: {error}"))?
        .join("Stage0 Updates");
    fs::create_dir_all(&download_dir)
        .map_err(|error| format!("Could not create the Stage0 Updates folder: {error}"))?;

    let destination = unique_destination(&download_dir, &file_name)?;
    let temporary_path = destination.with_file_name(format!(
        ".{}.{}.part",
        destination
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("stage0-update"),
        std::process::id()
    ));
    let mut partial_guard = PartialFileGuard(Some(temporary_path.clone()));
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .await
        .map_err(|error| format!("Could not create the update download file: {error}"))?;

    let mut stream = response.bytes_stream();
    let mut hasher = Sha256::new();
    let mut downloaded_bytes = 0_u64;
    let mut last_progress_at = Instant::now();
    let mut last_progress_bytes = 0_u64;
    let download_started_at = Instant::now();

    on_progress
        .send(progress(
            downloaded_bytes,
            total_bytes,
            download_started_at.elapsed(),
            0,
        ))
        .map_err(|error| format!("Could not report update download progress: {error}"))?;

    loop {
        let next_chunk = loop {
            if DOWNLOAD_CANCELLED.load(Ordering::Acquire) {
                return Err("Update download cancelled".into());
            }
            tokio::select! {
                chunk = stream.next() => break chunk,
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    if last_progress_at.elapsed() >= Duration::from_secs(1) {
                        on_progress
                            .send(progress(
                                downloaded_bytes,
                                total_bytes,
                                download_started_at.elapsed(),
                                0,
                            ))
                            .map_err(|error| format!("Could not report update download progress: {error}"))?;
                        last_progress_at = Instant::now();
                        last_progress_bytes = downloaded_bytes;
                    }
                    continue;
                },
            }
        };
        let Some(chunk) = next_chunk else { break };
        let chunk = chunk.map_err(|_| "Update download failed while receiving data".to_string())?;
        let chunk_size = u64::try_from(chunk.len()).unwrap_or(u64::MAX);
        downloaded_bytes = downloaded_bytes
            .checked_add(chunk_size)
            .ok_or_else(|| "Update download size overflowed".to_string())?;
        if downloaded_bytes > MAX_UPDATE_SIZE_BYTES
            || total_bytes.is_some_and(|total| downloaded_bytes > total)
        {
            return Err("Update download exceeded its declared package size".into());
        }

        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("Could not write the update package: {error}"))?;

        if last_progress_at.elapsed() >= Duration::from_millis(150) {
            let elapsed = last_progress_at.elapsed();
            let bytes_per_second = (downloaded_bytes.saturating_sub(last_progress_bytes) as f64
                / elapsed.as_secs_f64()) as u64;
            on_progress
                .send(progress(
                    downloaded_bytes,
                    total_bytes,
                    download_started_at.elapsed(),
                    bytes_per_second,
                ))
                .map_err(|error| format!("Could not report update download progress: {error}"))?;
            last_progress_at = Instant::now();
            last_progress_bytes = downloaded_bytes;
        }
    }

    file.flush()
        .await
        .map_err(|error| format!("Could not finish writing the update package: {error}"))?;
    file.sync_all()
        .await
        .map_err(|error| format!("Could not sync the update package to disk: {error}"))?;
    drop(file);

    if size_bytes.is_some_and(|expected| expected != downloaded_bytes) {
        return Err("The downloaded package size does not match the release metadata".into());
    }
    if content_length.is_some_and(|expected| expected != downloaded_bytes) {
        return Err("The downloaded package is incomplete".into());
    }

    let actual_checksum = format!("{:x}", hasher.finalize());
    if !actual_checksum.eq_ignore_ascii_case(&checksum) {
        return Err("The update package failed SHA-256 verification and was discarded".into());
    }

    finalize_downloaded_file(&temporary_path, &destination)?;
    let canonical_destination = match fs::canonicalize(&destination) {
        Ok(path) => path,
        Err(_) => {
            let _ = fs::remove_file(&destination);
            return Err("Could not resolve the verified update package path".into());
        }
    };
    if fs::remove_file(&temporary_path).is_err() {
        let _ = fs::remove_file(&destination);
        return Err("Could not clean up the temporary update download".into());
    }
    partial_guard.disarm();
    *LAST_VERIFIED_INSTALLER.lock().map_err(|_| {
        "Could not register the verified update package for installation".to_string()
    })? = Some(VerifiedInstaller {
        path: canonical_destination,
        checksum,
    });

    let total_bytes = Some(downloaded_bytes);
    on_progress
        .send(DownloadProgress {
            downloaded_bytes,
            total_bytes,
            percent: Some(100),
            bytes_per_second: 0,
        })
        .map_err(|error| format!("Could not report completed update download: {error}"))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn cancel_update_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::Release);
    while DOWNLOAD_ACTIVE.load(Ordering::Acquire) {
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[tauri::command]
pub fn install_update(app: AppHandle, artifact_path: String) -> Result<(), String> {
    if INSTALL_ACTIVE
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("The Stage0 update installer is already being launched".into());
    }
    let mut install_guard = InstallActiveGuard(true);
    let installer = resolve_verified_installer(&app, &artifact_path)?;
    #[cfg(target_os = "windows")]
    let mut command = match extension(&installer).as_str() {
        "msi" => {
            let mut command = Command::new("msiexec.exe");
            command.arg("/i").arg(&installer);
            command
        }
        "exe" => Command::new(&installer),
        _ => return Err("This Windows update installer format is not supported".into()),
    };

    #[cfg(target_os = "macos")]
    let mut command = match extension(&installer).as_str() {
        "dmg" | "pkg" => {
            let mut command = Command::new("/usr/bin/open");
            command.arg(&installer);
            command
        }
        _ => return Err("This macOS update installer format is not supported".into()),
    };

    #[cfg(target_os = "linux")]
    let mut command = match extension(&installer).as_str() {
        "deb" | "rpm" => {
            let mut command = Command::new("xdg-open");
            command.arg(&installer);
            command
        }
        "appimage" => {
            install_appimage_and_restart(&installer)?;
            clear_verified_installer();
            install_guard.disarm();
            app.exit(0);
            return Ok(());
        }
        _ => return Err("This Linux update installer format is not supported".into()),
    };

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!("Could not launch the operating-system update installer: {error}")
        })?;
    clear_verified_installer();
    install_guard.disarm();
    app.exit(0);
    Ok(())
}

fn validate_target(
    platform: &str,
    arch: &str,
    channel: &str,
    current_version: &str,
) -> Result<(), String> {
    let valid_target_part = |value: &str| {
        !value.is_empty()
            && value.len() <= 100
            && value.bytes().all(|byte| {
                byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"_-".contains(&byte)
            })
    };
    if !valid_target_part(platform) || !valid_target_part(arch) {
        return Err("Invalid update platform or architecture identifier".into());
    }
    let (native_platform, native_arch) = native_target()?;
    if platform != native_platform || arch != native_arch {
        return Err(
            "Update checks are restricted to this device's platform and architecture".into(),
        );
    }
    if !UPDATE_CHANNELS.contains(&channel) {
        return Err("Invalid update release channel".into());
    }
    if !valid_version_token(current_version) {
        return Err("Invalid current semantic version".into());
    }
    Ok(())
}

fn valid_version_token(version: &str) -> bool {
    !version.is_empty()
        && version.len() <= 100
        && version
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
}

fn native_target() -> Result<(String, String), String> {
    let platform = match std::env::consts::OS {
        "macos" => "macos",
        "windows" => "windows",
        "linux" => "linux",
        _ => return Err("This operating system is not supported by the update service".into()),
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        "x86" => "x86",
        "arm" => "arm",
        _ => {
            return Err("This processor architecture is not supported by the update service".into())
        }
    };
    Ok((platform.to_string(), arch.to_string()))
}

fn validate_release(release: &LatestRelease) -> Result<(), String> {
    if release.version.len() > 100
        || release
            .codename
            .as_ref()
            .is_some_and(|value| value.len() > 512)
        || release
            .changelog
            .as_ref()
            .is_some_and(|value| value.len() > 64 * 1024)
        || release.download_url.len() > 8192
    {
        return Err("The update service returned release metadata that is too large".into());
    }
    validate_filename(&release.file_name)?;
    let checksum = release.checksum.as_deref().ok_or_else(|| {
        "This release has no SHA-256 checksum; installation is blocked".to_string()
    })?;
    validate_sha256(checksum)?;
    let url = reqwest::Url::parse(&release.download_url)
        .map_err(|_| "The update service returned an invalid download URL".to_string())?;
    if !is_trusted_update_url(&url) {
        return Err("The update package URL is outside the trusted download service domain".into());
    }
    if release
        .size_bytes
        .is_some_and(|size| size == 0 || size > MAX_UPDATE_SIZE_BYTES)
    {
        return Err("The update service returned an invalid package size".into());
    }
    Ok(())
}

async fn send_download_request(
    request: reqwest::RequestBuilder,
) -> Result<reqwest::Response, String> {
    let send_request = request.send();
    tokio::pin!(send_request);
    loop {
        if DOWNLOAD_CANCELLED.load(Ordering::Acquire) {
            return Err("Update download cancelled".into());
        }
        tokio::select! {
            response = &mut send_request => {
                return response.map_err(|_| "Could not download the update package".to_string());
            }
            _ = tokio::time::sleep(Duration::from_millis(100)) => {}
        }
    }
}

fn validate_filename(file_name: &str) -> Result<(), String> {
    if file_name.is_empty()
        || file_name.len() > 180
        || file_name.starts_with('.')
        || file_name.ends_with('.')
        || file_name.ends_with(' ')
        || file_name == "."
        || file_name == ".."
        || !file_name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b" ._()-".contains(&byte))
        || Path::new(file_name).components().count() != 1
    {
        return Err("The update service returned an unsafe installer filename".into());
    }

    #[cfg(target_os = "windows")]
    let supported = ["exe", "msi"].contains(&extension_from_name(file_name).as_str());
    #[cfg(target_os = "macos")]
    let supported = ["dmg", "pkg"].contains(&extension_from_name(file_name).as_str());
    #[cfg(target_os = "linux")]
    let supported = ["deb", "rpm", "appimage"].contains(&extension_from_name(file_name).as_str());

    if !supported {
        return Err("The published update package format is not supported on this platform".into());
    }
    Ok(())
}

fn validate_sha256(checksum: &str) -> Result<(), String> {
    if checksum.len() != 64 || !checksum.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("The update service returned an invalid SHA-256 checksum".into());
    }
    Ok(())
}

fn is_trusted_update_url(url: &reqwest::Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    url.scheme() == "https"
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
        && (host == "downloadcenter.quoctran.space"
            || host.ends_with(".downloadcenter.quoctran.space"))
}

fn update_http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 {
                attempt.error("too many redirects")
            } else if is_trusted_update_url(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("update redirect left the trusted domain")
            }
        }))
        .build()
        .map_err(|error| format!("Could not initialize the update network client: {error}"))
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn extension_from_name(file_name: &str) -> String {
    Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn unique_destination(directory: &Path, file_name: &str) -> Result<PathBuf, String> {
    let source = Path::new(file_name);
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid installer filename".to_string())?;
    let extension = source.extension().and_then(|value| value.to_str());

    for suffix in 0..100_u32 {
        let candidate_name = if suffix == 0 {
            file_name.to_string()
        } else if let Some(extension) = extension {
            format!("{stem} ({suffix}).{extension}")
        } else {
            format!("{stem} ({suffix})")
        };
        let candidate = directory.join(candidate_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("Could not find an unused filename in the Stage0 Updates folder".into())
}

fn finalize_downloaded_file(temporary_path: &Path, destination: &Path) -> Result<(), String> {
    if fs::hard_link(temporary_path, destination).is_ok() {
        return Ok(());
    }

    // Some user-selected Downloads volumes do not support hard links. Fall back to
    // an exclusive create-and-copy, which still refuses to overwrite existing files.
    let mut source = fs::File::open(temporary_path)
        .map_err(|_| "Could not reopen the temporary update download".to_string())?;
    let mut target = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|_| {
            "Could not safely finalize the update package without replacing an existing file"
                .to_string()
        })?;
    if std::io::copy(&mut source, &mut target).is_err() || target.sync_all().is_err() {
        drop(target);
        let _ = fs::remove_file(destination);
        return Err("Could not safely copy the verified update package into place".into());
    }
    Ok(())
}

fn progress(
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    elapsed: Duration,
    bytes_per_second: u64,
) -> DownloadProgress {
    let percent = total_bytes
        .filter(|total| *total > 0)
        .map(|total| ((downloaded_bytes.saturating_mul(100) / total).min(100)) as u8);
    DownloadProgress {
        downloaded_bytes,
        total_bytes,
        percent,
        bytes_per_second: if elapsed.is_zero() {
            0
        } else {
            bytes_per_second
        },
    }
}

fn resolve_verified_installer(app: &AppHandle, artifact_path: &str) -> Result<PathBuf, String> {
    let update_directory = app
        .path()
        .download_dir()
        .map_err(|error| format!("Could not locate the Downloads folder: {error}"))?
        .join("Stage0 Updates");
    let expected_directory = fs::canonicalize(&update_directory)
        .map_err(|error| format!("Stage0 update folder is unavailable: {error}"))?;
    let requested_path = PathBuf::from(artifact_path);
    let canonical_path = fs::canonicalize(&requested_path)
        .map_err(|error| format!("Downloaded installer is unavailable: {error}"))?;
    if !canonical_path.starts_with(&expected_directory) {
        return Err("Installer path is outside the Stage0 Updates folder".into());
    }
    if !canonical_path.is_file() {
        return Err("Downloaded installer is not a regular file".into());
    }
    let verified_artifact = LAST_VERIFIED_INSTALLER
        .lock()
        .map_err(|_| "Could not verify the downloaded update package".to_string())?
        .clone()
        .ok_or_else(|| "No verified update package is available to install".to_string())?;
    if canonical_path != verified_artifact.path {
        return Err("Only the package verified during this session can be installed".into());
    }
    let mut file = fs::File::open(&canonical_path)
        .map_err(|_| "Could not open the verified update package".to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let bytes_read = file.read(&mut buffer).map_err(|_| {
            "Could not re-verify the update package before installation".to_string()
        })?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    if !format!("{:x}", hasher.finalize()).eq_ignore_ascii_case(&verified_artifact.checksum) {
        return Err("The update package changed after verification and cannot be installed".into());
    }
    Ok(canonical_path)
}

fn clear_verified_installer() {
    if let Ok(mut verified_installer) = LAST_VERIFIED_INSTALLER.lock() {
        *verified_installer = None;
    }
}

#[cfg(target_os = "linux")]
fn install_appimage_and_restart(installer: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let appimage = std::env::var_os("APPIMAGE")
        .map(PathBuf::from)
        .ok_or_else(|| "This Stage0 installation was not started from an AppImage".to_string())?;
    let target = fs::canonicalize(&appimage)
        .map_err(|error| format!("Could not resolve the running AppImage path: {error}"))?;
    if extension(&target) != "appimage" {
        return Err("The running Stage0 image does not have an AppImage extension".into());
    }

    let parent = target
        .parent()
        .ok_or_else(|| "Could not locate the running AppImage folder".to_string())?;
    let staging = parent.join(format!(".stage0-update-{}.AppImage", std::process::id()));
    fs::copy(installer, &staging).map_err(|error| {
        format!("Could not stage the new AppImage beside the installed one: {error}")
    })?;
    if let Err(error) = fs::set_permissions(&staging, fs::Permissions::from_mode(0o755)) {
        let _ = fs::remove_file(&staging);
        return Err(format!(
            "Could not mark the update AppImage executable: {error}"
        ));
    }

    const REPLACE_AND_RESTART: &str = r#"
set -eu
while kill -0 "$1" 2>/dev/null; do sleep 0.25; done
backup="$3.stage0-backup-$1"
if [ -e "$backup" ]; then exit 1; fi
mv -- "$3" "$backup"
if ! mv -- "$2" "$3"; then mv -- "$backup" "$3"; exit 1; fi
if ! chmod u+x "$3"; then rm -f -- "$3"; mv -- "$backup" "$3"; exit 1; fi
"$3" &
new_pid=$!
sleep 2
if kill -0 "$new_pid" 2>/dev/null; then
  rm -f -- "$backup"
else
  rm -f -- "$3"
  mv -- "$backup" "$3"
  exit 1
fi
"#;

    Command::new("sh")
        .arg("-c")
        .arg(REPLACE_AND_RESTART)
        .arg("stage0-update")
        .arg(std::process::id().to_string())
        .arg(&staging)
        .arg(&target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let _ = fs::remove_file(&staging);
            format!("Could not start the AppImage replacement helper: {error}")
        })?;
    Ok(())
}
