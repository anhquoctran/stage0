pub mod chatgpt_oauth;
pub mod cli_bridge;
pub mod copilot;
pub mod dynamic_models;
pub mod google_oauth;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedAiChatRequest {
    pub provider: String,
    pub auth_mode: String, // "cli_bridge", "subscription_oauth", "api_key"
    pub model: Option<String>,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub repo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedAiChatResponse {
    pub success: bool,
    pub content: String,
    pub duration_ms: u64,
    pub provider_used: String,
    pub error: Option<String>,
}

/// Unified dispatcher to route prompts to either CLI Bridge, Copilot Device Token, or Google OAuth
pub async fn dispatch_ai_chat(req: UnifiedAiChatRequest) -> Result<UnifiedAiChatResponse, String> {
    let start_time = std::time::Instant::now();
    let provider = req.provider.as_str();
    let auth_mode = req.auth_mode.as_str();

    match (provider, auth_mode) {
        // Phase 1: Local CLI Bridge
        ("claude", "cli_bridge") | ("claude_cli", _) => {
            let res = cli_bridge::execute_cli("claude", &req.prompt, req.repo_path.as_deref()).await?;
            Ok(UnifiedAiChatResponse {
                success: res.success,
                content: res.output,
                duration_ms: res.duration_ms,
                provider_used: "Claude Code CLI".to_string(),
                error: res.error,
            })
        }
        ("gh_copilot", "cli_bridge") => {
            let res = cli_bridge::execute_cli("gh_copilot", &req.prompt, req.repo_path.as_deref()).await?;
            Ok(UnifiedAiChatResponse {
                success: res.success,
                content: res.output,
                duration_ms: res.duration_ms,
                provider_used: "GitHub Copilot CLI".to_string(),
                error: res.error,
            })
        }
        ("grok", "cli_bridge") | ("xai_grok", "cli_bridge") | ("grok", "subscription_oauth") | ("xai_grok", "subscription_oauth") => {
            let res = cli_bridge::execute_cli("grok", &req.prompt, req.repo_path.as_deref()).await?;
            Ok(UnifiedAiChatResponse {
                success: res.success,
                content: res.output,
                duration_ms: res.duration_ms,
                provider_used: "SuperGrok CLI".to_string(),
                error: res.error,
            })
        }
        ("openai", "subscription_oauth") | ("chatgpt", "subscription_oauth") => {
            let content = chatgpt_oauth::chat_chatgpt_subscription(
                &req.prompt,
                req.system_prompt.as_deref(),
                req.model.as_deref(),
            )
            .await?;
            let duration_ms = start_time.elapsed().as_millis() as u64;
            Ok(UnifiedAiChatResponse {
                success: true,
                content,
                duration_ms,
                provider_used: "ChatGPT Subscription".to_string(),
                error: None,
            })
        }

        // Phase 2: Native GitHub Copilot Device Authorization (RFC 8628)
        ("github_copilot", _) | ("copilot", _) | (_, "subscription_oauth") if provider == "github_copilot" => {
            let content = copilot::chat_copilot(
                &req.prompt,
                req.system_prompt.as_deref(),
                req.model.as_deref(),
            )
            .await?;
            let duration_ms = start_time.elapsed().as_millis() as u64;
            Ok(UnifiedAiChatResponse {
                success: true,
                content,
                duration_ms,
                provider_used: "GitHub Copilot Subscription".to_string(),
                error: None,
            })
        }

        // Phase 3: Google AI Pro / Gemini Advanced OAuth 2.0 PKCE
        ("gemini_oauth", _) | ("google_oauth", _) | (_, "subscription_oauth") if provider == "gemini" => {
            let content = google_oauth::chat_gemini_oauth(
                &req.prompt,
                req.system_prompt.as_deref(),
                req.model.as_deref(),
            )
            .await?;
            let duration_ms = start_time.elapsed().as_millis() as u64;
            Ok(UnifiedAiChatResponse {
                success: true,
                content,
                duration_ms,
                provider_used: "Google AI Pro Subscription".to_string(),
                error: None,
            })
        }

        // Fallback or Unknown
        (p, m) => Err(format!(
            "Provider '{}' with auth mode '{}' is not supported via subscription bridge. Please use API key or configure subscription.",
            p, m
        )),
    }
}

/// Open URL in the operating system's default web browser
pub fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!("Start-Process '{}'", url.replace('\'', "''")),
        ]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Failed to launch system browser on Windows: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch system browser on macOS: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch system browser on Linux: {}", e))?;
        Ok(())
    }
}
pub mod commands;
