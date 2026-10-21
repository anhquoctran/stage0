use super::{git, ReviewContext};
use crate::features::review::security;

impl ReviewContext {
    pub(super) fn raw_blob_at(&self, path: &str, sha: &str) -> Result<Option<String>, String> {
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
            return Err("Only regular files from the selected snapshot can be read (no symlinks or submodules)".into());
        }
        let content = git(
            &self.snapshot.repo_path,
            &["show", &format!("{sha}:{path}")],
            256 * 1024,
        )?;
        if content.contains('\0') {
            return Err("Binary files are not reviewable as text".into());
        }
        Ok(Some(content))
    }

    pub(super) fn raw_blob(&self, path: &str, side: &str) -> Result<Option<String>, String> {
        let sha = match side {
            "base" => &self.snapshot.merge_base_sha,
            "head" => &self.snapshot.head_sha,
            _ => return Err("side must be base or head".into()),
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
