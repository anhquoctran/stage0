//! Credential facade. Discovery, clone leases and OS vault access have independent implementations.
mod os_keyring_info;
pub use os_keyring_info::OsKeyringInfo;
mod git_credential_meta;
pub use git_credential_meta::GitCredentialMeta;
mod git_credential_preference_record;
pub use git_credential_preference_record::GitCredentialPreferenceRecord;
mod system_git_credential_discovery;
pub use system_git_credential_discovery::SystemGitCredentialDiscovery;
mod git_credential_scan_coordinator;
pub use git_credential_scan_coordinator::GitCredentialScanCoordinator;
mod git_credential_scan_state;
use git_credential_scan_state::GitCredentialScanState;
mod save_git_credential_payload;
pub use save_git_credential_payload::SaveGitCredentialPayload;
mod helper_credential_lookup;

mod clone_auth;
pub mod commands;
mod discovery;
mod helper_lookup;
pub mod persistence;
mod remote_identity;
mod scan;
mod vault;

pub const KEYRING_SERVICE: &str = "stage0.git.credentials";
pub(crate) use clone_auth::retrieve_system_global_credential_for_clone;
pub use clone_auth::run_git_credential_helper;
pub use discovery::discover_system_git_credentials;
pub(crate) use remote_identity::https_origin;
pub use scan::schedule_system_git_credential_rescan;
pub(crate) use vault::store_ai_key_unlogged;
pub use vault::{
    ai_key_exists, delete_ai_key, delete_preference_secret, delete_secret, exists_in_keyring,
    get_ai_key, get_os_keyring_info, retrieve_preference_secret, retrieve_secret, store_ai_key,
    store_preference_secret, store_secret, AI_KEYRING_SERVICE, PREFERENCES_KEYRING_SERVICE,
};
