//! Agent Client Protocol facade: registry, transport, authentication and isolated review sessions.
mod acp_agent_config;
mod acp_registry;
mod acp_registry_agent;
mod archive_format;
mod auth;
mod binary_archive;
mod binary_download;
mod binary_install;
mod binary_platform;
mod launch_config;
mod process;
mod prompt;
mod registry_commands;
mod registry_icon;
mod registry_payload;
pub mod review_config;
mod review_session;

pub use acp_agent_config::AcpAgentConfig;
pub use acp_registry::AcpRegistry;
pub use acp_registry_agent::AcpRegistryAgent;
// Tauri generates companion macros; glob exports retain their stable IPC paths too.
pub use auth::*;
pub use launch_config::{validate_review_agent_config, validate_review_config_overrides};
use process::AcpProcess;
pub use prompt::*;
pub use registry_commands::*;
pub use registry_icon::*;
pub use review_session::AcpAgentReviewSession;

#[cfg(test)]
use launch_config::{make_command, validate_config};
#[cfg(test)]
mod tests;
