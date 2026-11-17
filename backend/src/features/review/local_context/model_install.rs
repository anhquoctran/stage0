//! Explicit, bounded, revision/checksum-pinned model download. No remote code.
use super::{
    files,
    model::{FILES, REVISION},
};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::Path,
};

pub(super) fn ready(root: &Path) -> bool {
    root.join("ready").is_file()
        && FILES.iter().all(|(name, len, _)| {
            std::fs::symlink_metadata(root.join(name))
                .is_ok_and(|m| m.is_file() && !m.file_type().is_symlink() && m.len() == *len)
        })
}

fn checksum(path: &Path, expected: &str) -> Result<(), String> {
    files::reject_link(path).map_err(|e| e.to_string())?;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buf = [0; 64 * 1024];
    loop {
        let size = file.read(&mut buf).map_err(|e| e.to_string())?;
        if size == 0 {
            break;
        }
        hash.update(&buf[..size]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err("Model checksum mismatch".into());
    }
    Ok(())
}

async fn checked_file(path: std::path::PathBuf, expected: &'static str) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || checksum(&path, expected))
        .await
        .map_err(|_| "Model verification worker stopped".to_owned())?
}

pub(super) fn verify(root: &Path) -> Result<(), String> {
    if let Some(parent) = root.parent() {
        files::reject_link(parent).map_err(|e| e.to_string())?;
    }
    files::reject_link(root).map_err(|e| e.to_string())?;
    if !ready(root) {
        return Err("Local embedding model is not installed".into());
    }
    for (name, _, hash) in FILES {
        checksum(&root.join(name), hash)?;
    }
    Ok(())
}

pub(super) async fn install(root: &Path) -> Result<(), String> {
    if let Some(parent) = root.parent() {
        files::directory(parent).map_err(|e| e.to_string())?;
    }
    files::directory(root).map_err(|e| e.to_string())?;
    files::reject_link(&root.join("ready")).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry
            .file_name()
            .to_str()
            .is_some_and(|name| name.starts_with("stage0-model-"))
            && entry.file_type().is_ok_and(|kind| kind.is_file())
        {
            std::fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
        }
    }
    if root.join("ready").exists() {
        std::fs::remove_file(root.join("ready")).map_err(|e| e.to_string())?;
    }
    // Redirects are required for HF's immutable weight storage. Only HTTPS is
    // permitted; no credentials, repository text or provider API keys are sent.
    let client = reqwest::Client::builder()
        .https_only(true)
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|e| e.to_string())?;
    for (name, length, hash) in FILES {
        let final_path = root.join(name);
        files::reject_link(&final_path).map_err(|e| e.to_string())?;
        if final_path.metadata().is_ok_and(|m| m.len() == length)
            && checked_file(final_path.clone(), hash).await.is_ok()
        {
            continue;
        }
        let url = format!(
            "https://huggingface.co/intfloat/multilingual-e5-small/resolve/{REVISION}/{name}"
        );
        let mut response = client
            .get(url)
            .send()
            .await
            .map_err(|_| "Model download failed")?
            .error_for_status()
            .map_err(|_| "Model download failed")?;
        if response.content_length().is_some_and(|len| len > length) {
            return Err("Model download exceeds size limit".into());
        }
        let mut temp = tempfile::Builder::new()
            .prefix("stage0-model-")
            .tempfile_in(root)
            .map_err(|e| e.to_string())?;
        files::private_file(temp.path()).map_err(|e| e.to_string())?;
        let mut downloaded = 0;
        while let Some(bytes) = response
            .chunk()
            .await
            .map_err(|_| "Model download interrupted")?
        {
            downloaded += bytes.len() as u64;
            if downloaded > length {
                return Err("Model download exceeds size limit".into());
            }
            temp.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        if downloaded != length {
            return Err("Incomplete model download".into());
        }
        temp.as_file().sync_all().map_err(|e| e.to_string())?;
        checked_file(temp.path().to_owned(), hash).await?;
        // Remove only the failed, fixed-name artifact; an installed/loaded model
        // is never replaced. Installation is serialized by the runtime.
        if final_path.exists() {
            std::fs::remove_file(&final_path).map_err(|e| e.to_string())?;
        }
        temp.persist(&final_path).map_err(|e| e.to_string())?;
    }
    let mut marker = tempfile::Builder::new()
        .prefix("stage0-model-")
        .tempfile_in(root)
        .map_err(|e| e.to_string())?;
    marker
        .write_all(REVISION.as_bytes())
        .map_err(|e| e.to_string())?;
    marker.as_file().sync_all().map_err(|e| e.to_string())?;
    if root.join("ready").exists() {
        std::fs::remove_file(root.join("ready")).map_err(|e| e.to_string())?;
    }
    marker
        .persist(root.join("ready"))
        .map_err(|e| e.to_string())?;
    Ok(())
}
