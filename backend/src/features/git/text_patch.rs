//! Replace only encoded file sections; preserve native UTF-8 Git diffs and paths.
use super::{text_content, ChangedFile};
use crate::common::{
    text_diff,
    text_encoding::{decode_buffer, DecodedText, TextEncoding},
};

const MAX_BLOB_BYTES: usize = 8 * 1024 * 1024;
const MAX_SCAN_BYTES: usize = 64 * 1024 * 1024;

pub(super) fn normalize_encoded_files(
    repo: &str,
    old_ref: Option<&str>,
    new_ref: &str,
    files: &mut [ChangedFile],
    raw: &str,
    cap: usize,
) -> (String, bool) {
    let mut output = String::with_capacity(raw.len().min(cap));
    let mut scanned = 0usize;
    let mut truncated = false;
    let mut sections = raw.split("\ndiff --git ").enumerate();
    for (index, section) in &mut sections {
        let owned;
        let section = if index == 0 {
            section
        } else {
            owned = format!("diff --git {section}");
            &owned
        };
        let header = section.lines().next().unwrap_or_default();
        let file = files.iter_mut().find(|file| {
            header
                == text_diff::file_header(
                    file.old_path.as_deref().unwrap_or(&file.path),
                    &file.path,
                )
        });
        let replacement = file.and_then(|file| {
            if !(file.is_binary || section.contains('\u{fffd}') || section.contains('\u{feff}')) {
                return None;
            }
            if scanned >= MAX_SCAN_BYTES {
                truncated = true;
                return None;
            }
            let old_path = file.old_path.as_deref().unwrap_or(&file.path);
            let old = if file.status == "ADDED" || old_ref.is_none() {
                None
            } else {
                Some(read(
                    repo,
                    old_ref?,
                    old_path,
                    &mut scanned,
                    &mut truncated,
                )?)
            };
            let new = if file.status == "DELETED" {
                None
            } else {
                Some(read(
                    repo,
                    new_ref,
                    &file.path,
                    &mut scanned,
                    &mut truncated,
                )?)
            };
            if !old
                .iter()
                .chain(new.iter())
                .any(|blob| blob.guess.encoding != TextEncoding::Utf8)
            {
                return None;
            }
            let patch = match text_diff::decoded_patch(
                &super::runner::get_active_git_path(),
                old.as_ref().map(|blob| blob.text.as_str()),
                new.as_ref().map(|blob| blob.text.as_str()),
                old_path,
                &file.path,
                cap.saturating_sub(output.len() + 1),
            ) {
                Ok(patch) => patch,
                Err(_) => {
                    truncated = true;
                    return None;
                }
            };
            let patch = text_diff::preserve_file_metadata(&patch, section);
            if patch.len() > cap.saturating_sub(output.len() + 1) {
                truncated = true;
                return None;
            }
            file.is_binary = false;
            file.additions = patch
                .lines()
                .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
                .count() as u32;
            file.deletions = patch
                .lines()
                .filter(|line| line.starts_with('-') && !line.starts_with("---"))
                .count() as u32;
            Some(patch)
        });
        let next = replacement.as_deref().unwrap_or(section);
        let separator = usize::from(!output.is_empty() && !output.ends_with('\n'));
        if output
            .len()
            .saturating_add(next.len())
            .saturating_add(separator)
            > cap
        {
            truncated = true;
            let notice = "\n[Encoded text diff truncated by preview safety limit.]\n";
            if output.len() + notice.len() <= cap {
                output.push_str(notice);
            }
            break;
        }
        if separator > 0 {
            output.push('\n');
        }
        output.push_str(next);
    }
    if truncated {
        let notice = "\n[Some encoded text previews exceeded the preview safety limit.]\n";
        if output.len() + notice.len() <= cap {
            output.push_str(notice);
        }
    }
    (output, truncated)
}

fn read(
    repo: &str,
    reference: &str,
    path: &str,
    scanned: &mut usize,
    truncated: &mut bool,
) -> Option<DecodedText> {
    let cap = MAX_BLOB_BYTES.min(MAX_SCAN_BYTES.saturating_sub(*scanned));
    let bytes = match text_content::read_blob_bytes(repo, reference, path, cap) {
        Ok(bytes) => bytes,
        Err(_) => {
            *scanned += cap;
            *truncated = true;
            return None;
        }
    };
    *scanned += bytes.len();
    decode_buffer(&bytes, None).ok()
}
