use super::{git, ReviewContext};
use crate::common::text_encoding::{decode_buffer, DecodedText, TextEncoding};
use crate::features::review::security;

impl ReviewContext {
    pub(super) fn raw_blob_at(&self, path: &str, sha: &str) -> Result<Option<String>, String> {
        Ok(self.decoded_blob_at(path, sha)?.map(|blob| blob.text))
    }

    pub(super) fn decoded_blob_at(
        &self,
        path: &str,
        sha: &str,
    ) -> Result<Option<DecodedText>, String> {
        security::safe_path(path, &self.guards)?;
        let entry = git(
            &self.snapshot.repo_path,
            &["ls-tree", sha, "--", path],
            4096,
        )?;
        if entry.is_empty() {
            return Ok(None);
        }
        if !(entry.starts_with("100644 blob ") || entry.starts_with("100755 blob ")) {
            return Err(crate::common::messages::failure("backend.review.reviewRegularFileOnly", serde_json::json!({}), "Only regular files from the selected snapshot can be read (no symlinks or submodules)".into()));
        }
        let bytes = super::snapshot::git_bytes(
            &self.snapshot.repo_path,
            &["show", &format!("{sha}:{path}")],
            256 * 1024,
        )?;
        let content = decode_buffer(&bytes, None).map_err(|_| {
            crate::common::messages::failure(
                "backend.review.reviewBinaryFileUnsupported",
                serde_json::json!({}),
                "Binary or malformed text files are not reviewable as text".into(),
            )
        })?;
        if matches!(
            content.guess.encoding,
            TextEncoding::Utf16Le | TextEncoding::Utf16Be
        ) {
            // ASCII-incompatible conversion must not encode a raw secret block
            // into unrelated Unicode and evade full-blob egress checks.
            let raw = String::from_utf8_lossy(&bytes);
            if security::redact(&raw) != raw {
                return Err("Text encoding would obscure a source egress restriction".into());
            }
        }
        Ok(Some(content))
    }

    pub(super) fn raw_blob(&self, path: &str, side: &str) -> Result<Option<String>, String> {
        let sha = match side {
            "base" => &self.snapshot.merge_base_sha,
            "head" => &self.snapshot.head_sha,
            _ => {
                return Err(crate::common::messages::failure(
                    "backend.review.reviewSideInvalid",
                    serde_json::json!({}),
                    "side must be base or head".into(),
                ))
            }
        };
        self.raw_blob_at(path, sha)
    }

    pub fn blob(&self, path: &str, side: &str) -> Result<String, String> {
        let content = self
            .raw_blob(path, side)?
            .ok_or("File does not exist on this snapshot side")?;
        Ok(security::redact(&content))
    }
}
