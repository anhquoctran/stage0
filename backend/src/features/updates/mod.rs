//! GitHub Releases updater. The webview never supplies URLs, keys or packages.
pub mod commands;
mod download;
mod policy;
mod runtime;
mod transport;
mod update_status;
mod workflow;

pub(super) const PENDING_RELEASE_NOTES_VERSION_SETTING: &str =
    "software_update_release_notes_version";

pub use runtime::UpdateRuntime;
pub use workflow::start_background_checks;

#[cfg(test)]
mod signature_tests;
#[cfg(test)]
mod tests;
