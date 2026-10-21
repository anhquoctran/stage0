//! Git operations grouped by workflow; callers retain the original ops API.
mod git_sync_options;
pub use git_sync_options::GitSyncOptions;
mod git_remote_detail;
pub use git_remote_detail::GitRemoteDetail;
mod git_tag_info;
pub use git_tag_info::GitTagInfo;
mod git_commit_item;
pub use git_commit_item::GitCommitItem;

mod history;
mod ref_validation;
mod refs;
mod remote_url;
mod remotes;
mod sync;

pub use history::*;
pub use refs::*;
pub use remote_url::validate_remote_url;
pub use remotes::*;
pub use sync::*;

#[cfg(test)]
mod tests;
