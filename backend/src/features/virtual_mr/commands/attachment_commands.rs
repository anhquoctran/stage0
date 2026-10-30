use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::path::Path;
use tauri::{AppHandle, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SavedImageAttachment {
    pub file_name: String,
    pub file_path: String,
    pub relative_path: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub data_url: String,
}

const MAX_IMAGE_ATTACHMENT_BYTES: usize = 15 * 1024 * 1024; // 15 MiB

pub(super) fn sanitize_attachment_filename(raw: &str) -> String {
    let clean: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = clean.trim_matches(|c| c == '.' || c == '_' || c == '-');
    if trimmed.is_empty() {
        "attachment".to_string()
    } else {
        trimmed.to_string()
    }
}

pub(super) fn validate_and_normalize_image_mime(
    file_name: &str,
    mime_type: &str,
) -> Result<(&'static str, &'static str), String> {
    let lower_mime = mime_type.to_ascii_lowercase();
    let lower_ext = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_default();

    match (lower_mime.as_str(), lower_ext.as_str()) {
        ("image/png", _) | (_, "png") => Ok(("image/png", "png")),
        ("image/jpeg", _) | ("image/jpg", _) | (_, "jpg") | (_, "jpeg") => {
            Ok(("image/jpeg", "jpg"))
        }
        ("image/gif", _) | (_, "gif") => Ok(("image/gif", "gif")),
        ("image/webp", _) | (_, "webp") => Ok(("image/webp", "webp")),
        ("image/svg+xml", _) | (_, "svg") => Ok(("image/svg+xml", "svg")),
        _ => Err(format!(
            "Only image files (PNG, JPG, GIF, WebP, SVG) are supported in this sandbox environment. Received file: '{}' with type: '{}'",
            file_name, mime_type
        )),
    }
}

#[tauri::command]
pub async fn save_mr_image_attachment(
    app: AppHandle,
    file_name: String,
    data_base64: String,
    mime_type: String,
) -> Result<SavedImageAttachment, String> {
    let result: Result<_, String> = async {
        tauri::async_runtime::spawn_blocking(move || {
            let (canonical_mime, canonical_ext) =
                validate_and_normalize_image_mime(&file_name, &mime_type)?;

            let pure_base64 = if let Some(idx) = data_base64.find(";base64,") {
                &data_base64[idx + 8..]
            } else {
                &data_base64
            };

            let decoded_bytes = BASE64
                .decode(pure_base64.trim())
                .map_err(|e| format!("Invalid base64 image data: {}", e))?;

            if decoded_bytes.is_empty() {
                return Err("Image payload cannot be empty".to_string());
            }

            if decoded_bytes.len() > MAX_IMAGE_ATTACHMENT_BYTES {
                return Err(format!(
                    "Image size ({} bytes) exceeds the sandbox limit of 15 MiB",
                    decoded_bytes.len()
                ));
            }

            let tmp_root = match app.path().app_data_dir() {
                Ok(dir) => dir.join("tmp").join("attachments"),
                Err(_) => std::env::temp_dir()
                    .join("stage0")
                    .join("tmp")
                    .join("attachments"),
            };

            std::fs::create_dir_all(&tmp_root)
                .map_err(|e| format!("Failed to create temporary attachment directory: {}", e))?;

            let sanitized_base = sanitize_attachment_filename(&file_name);
            let safe_stem = Path::new(&sanitized_base)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("attachment");
            let unique_filename = format!(
                "{}_{}_{}.{}",
                chrono::Utc::now().timestamp_millis(),
                &uuid::Uuid::new_v4().simple().to_string()[..8],
                safe_stem,
                canonical_ext
            );

            let target_file_path = tmp_root.join(&unique_filename);
            std::fs::write(&target_file_path, &decoded_bytes)
                .map_err(|e| format!("Failed to write temporary image file: {}", e))?;

            let relative_path = format!("tmp/attachments/{}", unique_filename);
            let data_url = format!("data:{};base64,{}", canonical_mime, pure_base64.trim());

            Ok(SavedImageAttachment {
                file_name: unique_filename,
                file_path: target_file_path.to_string_lossy().to_string(),
                relative_path,
                mime_type: canonical_mime.to_string(),
                size_bytes: decoded_bytes.len(),
                data_url,
            })
        })
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
    }
    .await;
    result.map_err(|error| crate::common::messages::command_error("virtualMr", error))
}
