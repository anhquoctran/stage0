//! Human feedback may describe a finding or explicitly teach an addressed bot.
use crate::features::{
    review::{mentions, security},
    virtual_mr::persistence::{VirtualMrCommentDb, VirtualMrDiscussionDb},
};

pub(super) fn inline(thread: &VirtualMrDiscussionDb, reviewer: Option<&str>) -> bool {
    thread.file_path.is_some()
        && thread.commit_id.is_some()
        && thread
            .comments
            .first()
            .is_some_and(|c| c.author_type == "ai_agent" && Some(c.author_id.as_str()) == reviewer)
}

pub(crate) fn history(thread: &VirtualMrDiscussionDb) -> &[VirtualMrCommentDb] {
    let end = thread
        .comments
        .iter()
        .rposition(|c| c.author_type == "user")
        .map(|i| i + 1)
        .unwrap_or(0);
    &thread.comments[..end]
}

pub(super) fn eligible(thread: &VirtualMrDiscussionDb, reviewer: Option<&str>) -> bool {
    let Some(human) = history(thread).last() else {
        return false;
    };
    if history(thread).len() > 64 || security::redact(&human.body).trim().is_empty() {
        return false;
    }
    if inline(thread, reviewer) {
        return true;
    }
    thread.file_path.is_none()
        && thread
            .comments
            .first()
            .is_some_and(|c| matches!(c.author_type.as_str(), "user" | "ai_agent"))
        && reviewer.is_some_and(|id| mentions::has_reviewer_mention(&human.body, id))
        && !mentions::is_manual_review_command(&human.body)
}
