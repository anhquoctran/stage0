use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OsKeyringInfo {
    pub os: String,
    pub keyring_name: String,
    pub is_available: bool,
}
