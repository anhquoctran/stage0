use super::GuardrailMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailPolicy {
    pub mode: GuardrailMode,
    pub allowed_commands: Vec<String>,
    pub blocked_commands: Vec<String>,
    pub blocked_patterns: Vec<String>,
    pub sensitive_path_patterns: Vec<String>,
    pub max_execution_timeout_secs: u64,
    pub max_file_read_lines: usize,
    pub max_output_bytes: usize,
    pub rate_limit_per_minute: u32,
    pub require_human_confirmation_for_commands: bool,
    pub require_human_confirmation_for_writes: bool,
}

impl Default for GuardrailPolicy {
    fn default() -> Self {
        Self::balanced()
    }
}

impl GuardrailPolicy {
    pub fn strict() -> Self {
        Self {
            mode: GuardrailMode::Strict,
            allowed_commands: vec![
                "cargo check".to_string(),
                "cargo test".to_string(),
                "cargo clippy".to_string(),
                "npm test".to_string(),
                "npm run lint".to_string(),
                "pnpm test".to_string(),
                "yarn test".to_string(),
                "pytest".to_string(),
                "go test".to_string(),
            ],
            blocked_commands: Self::default_blocked_commands(),
            blocked_patterns: Self::default_blocked_patterns(),
            sensitive_path_patterns: Self::default_sensitive_path_patterns(),
            max_execution_timeout_secs: 15,
            max_file_read_lines: 1000,
            max_output_bytes: 32 * 1024,
            rate_limit_per_minute: 30,
            require_human_confirmation_for_commands: true,
            require_human_confirmation_for_writes: true,
        }
    }

    pub fn balanced() -> Self {
        Self {
            mode: GuardrailMode::Balanced,
            allowed_commands: vec![
                "cargo".to_string(),
                "rustc".to_string(),
                "npm".to_string(),
                "npx".to_string(),
                "pnpm".to_string(),
                "yarn".to_string(),
                "node".to_string(),
                "pytest".to_string(),
                "python".to_string(),
                "python3".to_string(),
                "go".to_string(),
                "dotnet".to_string(),
                "make".to_string(),
                "git".to_string(),
            ],
            blocked_commands: Self::default_blocked_commands(),
            blocked_patterns: Self::default_blocked_patterns(),
            sensitive_path_patterns: Self::default_sensitive_path_patterns(),
            max_execution_timeout_secs: 45,
            max_file_read_lines: 2500,
            max_output_bytes: 64 * 1024,
            rate_limit_per_minute: 60,
            require_human_confirmation_for_commands: false,
            require_human_confirmation_for_writes: true,
        }
    }

    pub fn permissive() -> Self {
        Self {
            mode: GuardrailMode::Permissive,
            allowed_commands: vec![
                "cargo".to_string(),
                "rustc".to_string(),
                "npm".to_string(),
                "npx".to_string(),
                "pnpm".to_string(),
                "yarn".to_string(),
                "node".to_string(),
                "pytest".to_string(),
                "python".to_string(),
                "python3".to_string(),
                "go".to_string(),
                "dotnet".to_string(),
                "make".to_string(),
                "git".to_string(),
                "bash".to_string(),
                "sh".to_string(),
            ],
            blocked_commands: Self::default_blocked_commands(),
            blocked_patterns: Self::default_blocked_patterns(),
            sensitive_path_patterns: Self::default_sensitive_path_patterns(),
            max_execution_timeout_secs: 120,
            max_file_read_lines: 5000,
            max_output_bytes: 128 * 1024,
            rate_limit_per_minute: 120,
            require_human_confirmation_for_commands: false,
            require_human_confirmation_for_writes: false,
        }
    }

    pub(super) fn default_blocked_commands() -> Vec<String> {
        vec![
            "rm".to_string(),
            "del".to_string(),
            "rmdir".to_string(),
            "format".to_string(),
            "mkfs".to_string(),
            "dd".to_string(),
            "fdisk".to_string(),
            "shutdown".to_string(),
            "reboot".to_string(),
            "kill".to_string(),
            "killall".to_string(),
            "taskkill".to_string(),
            "curl".to_string(),
            "wget".to_string(),
            "powershell".to_string(),
            "cmd".to_string(),
        ]
    }

    pub(super) fn default_blocked_patterns() -> Vec<String> {
        vec![
            "| sh".to_string(),
            "| bash".to_string(),
            "|sh".to_string(),
            "|bash".to_string(),
            "> /dev/".to_string(),
            ">/dev/".to_string(),
            "sudo ".to_string(),
            "chmod 777".to_string(),
            ":(){ :|:& };:".to_string(),
            "--force".to_string(),
            "-f".to_string(),
            "clean -xdf".to_string(),
            "clean -fdx".to_string(),
        ]
    }

    pub(super) fn default_sensitive_path_patterns() -> Vec<String> {
        vec![
            ".env".to_string(),
            ".env.".to_string(),
            ".git/config".to_string(),
            ".git/credentials".to_string(),
            "id_rsa".to_string(),
            "id_ed25519".to_string(),
            ".pem".to_string(),
            ".key".to_string(),
            ".pkcs12".to_string(),
            ".pfx".to_string(),
            "token".to_string(),
            "secret".to_string(),
            "credentials.json".to_string(),
            "service-account".to_string(),
        ]
    }
}
