//! Exact context through the human decision, excluding later acknowledgements.
use crate::features::virtual_mr::persistence::VirtualMrDiscussionDb;
use serde_json::json;
use sha2::{Digest, Sha256};

pub(crate) fn key_for_comment(thread: &VirtualMrDiscussionDb, id: &str) -> Option<String> {
    let end = thread
        .comments
        .iter()
        .position(|c| c.id == id && c.author_type == "user")?;
    if end >= 64 {
        return None;
    }
    let mut digest = Sha256::new();
    digest.update(b"conversation-v2");
    let header = serde_json::to_vec(&(
        thread.file_path.as_ref(),
        thread.diff_side.as_ref(),
        thread.commit_id.as_ref(),
    ))
    .ok()?;
    digest.update((header.len() as u64).to_be_bytes());
    digest.update(header);
    // Hash borrowed bodies incrementally instead of duplicating a long thread.
    for comment in &thread.comments[..=end] {
        for value in [
            &comment.id,
            &comment.author_type,
            &comment.author_id,
            &comment.author_name,
            &comment.body,
        ] {
            digest.update((value.len() as u64).to_be_bytes());
            digest.update(value.as_bytes());
        }
    }
    Some(format!("{:x}", digest.finalize()))
}

/// Existing notes/tombstones retain their original fingerprint after upgrade.
pub(super) fn legacy_key(thread: &VirtualMrDiscussionDb, id: &str) -> Option<String> {
    let root = thread.comments.first()?;
    let human = thread
        .comments
        .iter()
        .find(|c| c.id == id && c.author_type == "user")?;
    Some(format!(
        "{:x}",
        Sha256::digest(
            json!([
                root.id,
                root.body,
                human.id,
                human.body,
                thread.file_path,
                thread.diff_side,
                thread.commit_id
            ])
            .to_string()
            .as_bytes()
        )
    ))
}

/// Editing a proposal is not a new human confirmation in a general discussion.
pub(super) fn processed_key(thread: &VirtualMrDiscussionDb) -> Option<String> {
    let human = thread
        .comments
        .iter()
        .rev()
        .find(|c| c.author_type == "user")?;
    if thread.file_path.is_some() {
        return key_for_comment(thread, &human.id);
    }
    Some(format!(
        "{:x}",
        Sha256::digest(
            json!(["human-decision", human.id, human.author_id, human.body])
                .to_string()
                .as_bytes()
        )
    ))
}
