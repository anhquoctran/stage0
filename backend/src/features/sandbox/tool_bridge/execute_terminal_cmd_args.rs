use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteTerminalCmdArgs {
    pub command: String,
    pub args: Vec<String>,
}
