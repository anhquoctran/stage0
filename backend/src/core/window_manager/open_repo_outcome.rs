use crate::features::git::RepoInfo;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum OpenRepoOutcome {
    OpenedHere {
        repo: RepoInfo,
    },
    FocusedExisting {
        window_label: String,
        repo: RepoInfo,
    },
    OpenedNewWindow {
        window_label: String,
        repo: RepoInfo,
    },
}
