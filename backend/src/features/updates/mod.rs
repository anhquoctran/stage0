//! GitHub Releases updater. The webview never supplies URLs, keys or packages.
pub mod commands;
mod download;
mod policy;
mod runtime;
mod transport;
mod update_status;
mod workflow;

pub use runtime::UpdateRuntime;
pub use workflow::start_background_checks;

#[cfg(test)]
mod signature_tests;
#[cfg(test)]
mod tests;
