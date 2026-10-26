use super::{policy, runtime::UpdateRuntime, transport};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub(super) async fn download(app: &AppHandle) -> Result<(), String> {
    let runtime = app.state::<UpdateRuntime>();
    let _operation = runtime
        .operation
        .try_lock()
        .map_err(|_| "An update operation is already running")?;
    runtime.require_supported()?;
    let update = runtime
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
        .map(|(update, _)| update.clone())
        .ok_or("Check for a new version before downloading")?;
    policy::validate_download(&update.download_url, &update.version)?;
    runtime.change(app, |status| {
        status.phase = "downloading".into();
        status.message = None;
        status.downloaded_bytes = 0;
        status.total_bytes = None;
    });
    let mut last_progress = Instant::now() - Duration::from_secs(1);
    let result = transport::fetch(
        update.download_url.as_str(),
        policy::PACKAGE_LIMIT,
        Duration::from_secs(600),
        |downloaded, total| {
            if last_progress.elapsed() >= Duration::from_millis(150) {
                runtime.change(app, |status| {
                    status.downloaded_bytes = downloaded;
                    status.total_bytes = total;
                });
                last_progress = Instant::now();
            }
        },
    )
    .await;
    let bytes = match result {
        Ok(Some(bytes)) => bytes,
        Ok(None) => {
            runtime.fail(app, "The release package is missing. Check again later.");
            return Err("The release package is missing. Check again later.".into());
        }
        Err(error) => {
            runtime.fail(app, &error);
            return Err(error);
        }
    };
    // Official verification also binds the signed version to the manifest version.
    if update.verify(&bytes).is_err() {
        runtime.fail(
            app,
            "The update signature or signed version is invalid. Installation was blocked.",
        );
        return Err(
            "The update signature or signed version is invalid. Installation was blocked.".into(),
        );
    }
    let size = bytes.len() as u64;
    *runtime
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some((update, Some(bytes)));
    runtime.change(app, |status| {
        status.phase = "ready".into();
        status.downloaded_bytes = size;
        status.total_bytes = Some(size);
        status.message = Some("Verified and ready to install.".into());
    });
    Ok(())
}
