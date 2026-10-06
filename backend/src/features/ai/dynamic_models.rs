use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiModelItem {
    id: String,
}

#[derive(Deserialize)]
struct OpenAiModelListResponse {
    data: Option<Vec<OpenAiModelItem>>,
}

#[derive(Deserialize)]
struct AnthropicModelItem {
    id: String,
    display_name: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicModelListResponse {
    data: Option<Vec<AnthropicModelItem>>,
}

#[derive(Deserialize)]
struct GeminiModelItem {
    name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "supportedGenerationMethods")]
    supported_generation_methods: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct GeminiModelListResponse {
    models: Option<Vec<GeminiModelItem>>,
}

#[derive(Deserialize)]
struct OllamaTagItem {
    name: String,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaTagItem>>,
}

#[derive(Deserialize)]
struct CopilotModelItem {
    id: String,
    name: Option<String>,
}

#[derive(Deserialize)]
struct CopilotModelListResponse {
    data: Option<Vec<CopilotModelItem>>,
}

/// Fetch real-time available models from AI providers (OpenAI, Anthropic, Google, xAI, Copilot, Ollama)
pub async fn fetch_provider_models(
    provider: &str,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> Result<Vec<DynamicModelInfo>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Resolve key from param or OS Keyring
    let resolved_key = if let Some(k) = api_key.filter(|k| !k.trim().is_empty()) {
        Some(k.to_string())
    } else {
        crate::features::credentials::get_ai_key(provider)
            .ok()
            .filter(|k| !k.trim().is_empty())
    };

    match provider {
        "openai" => {
            let mut list = Vec::new();

            // Attempt to query dynamic models if API key is provided
            if let Some(key) = resolved_key {
                let root_url = base_url
                    .unwrap_or("https://api.openai.com/v1")
                    .trim_end_matches('/');
                let url = format!("{}/models", root_url);

                if let Ok(resp) = client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", key))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<OpenAiModelListResponse>().await {
                            if let Some(items) = data.data {
                                for item in items {
                                    let id = item.id;
                                    // Filter for chat / code / reasoning models
                                    let is_chat = id.starts_with("gpt-")
                                        || id.starts_with("o1")
                                        || id.starts_with("o3")
                                        || id.starts_with("o4")
                                        || id.starts_with("chatgpt-");
                                    let is_excluded = id.contains("whisper")
                                        || id.contains("tts")
                                        || id.contains("dall-e")
                                        || id.contains("embedding")
                                        || id.contains("babbage")
                                        || id.contains("davinci")
                                        || id.contains("realtime");

                                    if is_chat && !is_excluded {
                                        let name = id.clone();
                                        list.push(DynamicModelInfo {
                                            id,
                                            name,
                                            description: Some("OpenAI Official Model".to_string()),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Always guarantee the latest OpenAI frontier models (Codex / ChatGPT)
            let required_models = [
                (
                    "gpt-6.1-sol",
                    "GPT-6.1 Sol",
                    "Flagship Frontier Intelligence & Coding",
                ),
                (
                    "gpt-6-astra",
                    "GPT-6 Astra",
                    "High-Velocity Agentic Architecture",
                ),
                ("gpt-6-sol", "GPT-6 Sol", "Deep Reasoning & System Design"),
                ("gpt-6-luna", "GPT-6 Luna", "Fast & Efficient GPT-6 Tier"),
                ("gpt-5.6-sol", "GPT-5.6 Sol", "Balanced Agentic Workloads"),
                (
                    "gpt-5.6-terra",
                    "GPT-5.6 Terra",
                    "Grounded Analysis & Refactoring",
                ),
                (
                    "gpt-5.6-luna",
                    "GPT-5.6 Luna",
                    "Rapid Feedback & Lightweight Tasks",
                ),
                ("gpt-5.5", "GPT-5.5", "Legacy Stable (Leaving Oct 14)"),
                ("o3-mini", "o3-mini", "Deep Code Reasoning"),
                ("o1", "o1", "Complex Problem Solving"),
                ("gpt-4o", "GPT-4o (Legacy)", "Fast & Intelligent"),
                ("gpt-4o-mini", "GPT-4o Mini (Legacy)", "Ultra-fast & Cheap"),
            ];

            for (req_id, req_name, req_desc) in required_models {
                if let Some(pos) = list.iter().position(|m| m.id == req_id) {
                    list[pos].name = req_name.to_string();
                    list[pos].description = Some(req_desc.to_string());
                } else {
                    list.push(DynamicModelInfo {
                        id: req_id.to_string(),
                        name: req_name.to_string(),
                        description: Some(req_desc.to_string()),
                    });
                }
            }

            // Sort to place newest GPT-6 and GPT-5.6 Codex models at the top
            list.sort_by(|a, b| {
                let score = |id: &str| {
                    if id == "gpt-6.1-sol" || id.contains("6.1-sol") {
                        20
                    } else if id == "gpt-6-astra" || id.contains("6-astra") {
                        19
                    } else if id == "gpt-6-sol" || id.contains("6-sol") {
                        18
                    } else if id == "gpt-6-luna" || id.contains("6-luna") {
                        17
                    } else if id == "gpt-5.6-sol" || id.contains("5.6-sol") {
                        16
                    } else if id == "gpt-5.6-terra" || id.contains("5.6-terra") {
                        15
                    } else if id == "gpt-5.6-luna" || id.contains("5.6-luna") {
                        14
                    } else if id == "gpt-5.5" || id.contains("5.5") {
                        13
                    } else if id.starts_with("o3") {
                        10
                    } else if id.starts_with("o1") {
                        9
                    } else if id.starts_with("gpt-4o") {
                        8
                    } else if id.starts_with("gpt-4") {
                        7
                    } else {
                        0
                    }
                };
                score(&b.id)
                    .cmp(&score(&a.id))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(list)
        }

        "xai_grok" | "grok" | "xai" => {
            let key = resolved_key.ok_or_else(|| {
                "xAI API key is required to query dynamic Grok models. Please enter an API key or use Grok CLI.".to_string()
            })?;
            let root_url = base_url
                .unwrap_or("https://api.x.ai/v1")
                .trim_end_matches('/');
            let url = format!("{}/models", root_url);

            let resp = client
                .get(&url)
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| format!("Network error querying xAI Grok models: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("xAI API error ({status}): {body}"));
            }

            let data: OpenAiModelListResponse = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse xAI models response: {}", e))?;

            let mut list = Vec::new();
            if let Some(items) = data.data {
                for item in items {
                    let id = item.id;
                    if id.starts_with("grok") {
                        let desc = if id.contains("4.7") {
                            Some("Grok 4.7 Flagship Reasoning & Agentic Coding".to_string())
                        } else if id.contains("4") {
                            Some("Grok 4 Advanced Reasoning".to_string())
                        } else if id.contains("3-mini") {
                            Some("Grok 3 Mini High Speed".to_string())
                        } else if id.contains("3") {
                            Some("Grok 3 Deep Reasoning".to_string())
                        } else {
                            Some("xAI Grok Model".to_string())
                        };
                        let name = id.clone();
                        list.push(DynamicModelInfo {
                            id,
                            name,
                            description: desc,
                        });
                    }
                }
            }

            // Always ensure latest grok-4.7, grok-4, grok-3, grok-3-mini are present
            let required_models = [
                (
                    "grok-4.7",
                    "Grok 4.7",
                    "State-of-the-Art Coding & Agentic Reasoning",
                ),
                ("grok-4", "Grok 4", "Advanced Reasoning & Architecture"),
                ("grok-3", "Grok 3", "Deep Coding & Math Reasoning"),
                ("grok-3-mini", "Grok 3 Mini", "Fast & Efficient Reasoning"),
                ("grok-2", "Grok 2", "Balanced Code Review"),
            ];

            for (req_id, req_name, req_desc) in required_models {
                if !list.iter().any(|m| m.id == req_id) {
                    list.push(DynamicModelInfo {
                        id: req_id.to_string(),
                        name: req_name.to_string(),
                        description: Some(req_desc.to_string()),
                    });
                }
            }

            // Sort to place 4.7, 4, 3 at the top
            list.sort_by(|a, b| {
                let score = |id: &str| {
                    if id.contains("4.7") {
                        5
                    } else if id.contains("4") {
                        4
                    } else if id.contains("3-mini") {
                        2
                    } else if id.contains("3") {
                        3
                    } else if id.contains("2") {
                        1
                    } else {
                        0
                    }
                };
                score(&b.id)
                    .cmp(&score(&a.id))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(list)
        }

        "anthropic" => {
            let mut list = Vec::new();

            // Attempt to query live dynamic models if API key is provided
            if let Some(key) = resolved_key {
                let url = "https://api.anthropic.com/v1/models";

                if let Ok(resp) = client
                    .get(url)
                    .header("x-api-key", &key)
                    .header("anthropic-version", "2023-06-01")
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<AnthropicModelListResponse>().await {
                            if let Some(items) = data.data {
                                for item in items {
                                    let id = item.id;
                                    if id.starts_with("claude-") {
                                        let name = item.display_name.unwrap_or_else(|| id.clone());
                                        list.push(DynamicModelInfo {
                                            id,
                                            name,
                                            description: Some(
                                                "Anthropic Claude Official".to_string(),
                                            ),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Always guarantee the official latest generation models from Anthropic documentation
            let required_models = [
                (
                    "claude-opus-5-5",
                    "Claude Opus 5.5",
                    "Long-running agentic coding and knowledge work",
                ),
                (
                    "claude-fable-5-1",
                    "Claude Fable 5.1",
                    "Demanding reasoning and long-horizon agentic work",
                ),
                (
                    "claude-sonnet-5-5",
                    "Claude Sonnet 5.5",
                    "Best combination of speed and intelligence",
                ),
                (
                    "claude-haiku-4-5-20251001",
                    "Claude Haiku 4.5",
                    "Fastest model with near-frontier intelligence",
                ),
                (
                    "claude-3-7-sonnet-20250219",
                    "Claude 3.7 Sonnet (Legacy)",
                    "Hybrid Reasoning & Coding",
                ),
                (
                    "claude-3-5-sonnet-20241022",
                    "Claude 3.5 Sonnet v2 (Legacy)",
                    "Industry Standard Code Review",
                ),
            ];

            for (req_id, req_name, req_desc) in required_models {
                if let Some(pos) = list.iter().position(|m| m.id == req_id) {
                    list[pos].name = req_name.to_string();
                    list[pos].description = Some(req_desc.to_string());
                } else {
                    list.push(DynamicModelInfo {
                        id: req_id.to_string(),
                        name: req_name.to_string(),
                        description: Some(req_desc.to_string()),
                    });
                }
            }

            // Sort to place Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 4.5 at the top
            list.sort_by(|a, b| {
                let score = |id: &str| {
                    if id == "claude-opus-5-5" || id.contains("opus-5-5") {
                        10
                    } else if id == "claude-fable-5-1" || id.contains("fable-5-1") {
                        9
                    } else if id == "claude-sonnet-5-5" || id.contains("sonnet-5-5") {
                        8
                    } else if id.starts_with("claude-haiku-4-5") || id.contains("haiku-4-5") {
                        7
                    } else if id.contains("3-7-sonnet") {
                        6
                    } else if id.contains("3-5-sonnet") {
                        5
                    } else {
                        0
                    }
                };
                score(&b.id)
                    .cmp(&score(&a.id))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(list)
        }

        "gemini" => {
            let mut list = Vec::new();

            // Try with API key first if available
            if let Some(key) = resolved_key {
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models?key={}",
                    key
                );
                if let Ok(resp) = client.get(&url).send().await {
                    if resp.status().is_success() {
                        if let Ok(data) = resp.json::<GeminiModelListResponse>().await {
                            if let Some(items) = data.models {
                                for item in items {
                                    let is_gen = item
                                        .supported_generation_methods
                                        .as_ref()
                                        .map_or(false, |m| {
                                            m.iter().any(|method| method == "generateContent")
                                        });
                                    if is_gen {
                                        let clean_id =
                                            item.name.trim_start_matches("models/").to_string();
                                        // Filter for gemini models
                                        if clean_id.starts_with("gemini-") {
                                            list.push(DynamicModelInfo {
                                                id: clean_id.clone(),
                                                name: item.display_name.unwrap_or(clean_id),
                                                description: Some(
                                                    "Google Gemini Official".to_string(),
                                                ),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Fallback default list if API key is empty or failed
            if list.is_empty() {
                list.push(DynamicModelInfo {
                    id: "gemini-2.0-flash".to_string(),
                    name: "Gemini 2.0 Flash".to_string(),
                    description: Some("Fast, High Quota & Multimodal".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "gemini-2.0-pro-exp-02-05".to_string(),
                    name: "Gemini 2.0 Pro Experimental".to_string(),
                    description: Some("Deep Reasoning & Complex Code".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "gemini-1.5-pro".to_string(),
                    name: "Gemini 1.5 Pro".to_string(),
                    description: Some("2M Token Context Window".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "gemini-1.5-flash".to_string(),
                    name: "Gemini 1.5 Flash".to_string(),
                    description: Some("Lightweight & Fast".to_string()),
                });
            }

            Ok(list)
        }

        "ollama" => {
            let root_url = base_url
                .unwrap_or("http://localhost:11434")
                .trim_end_matches('/');
            let url = format!("{}/api/tags", root_url);

            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Could not reach Ollama at {}: {}", url, e))?;

            if !resp.status().is_success() {
                return Err(format!("Ollama returned status {}", resp.status()));
            }

            let data: OllamaTagsResponse = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Ollama tags response: {}", e))?;

            let mut list = Vec::new();
            if let Some(items) = data.models {
                for item in items {
                    list.push(DynamicModelInfo {
                        id: item.name.clone(),
                        name: item.name,
                        description: Some("Local Ollama Model".to_string()),
                    });
                }
            }

            Ok(list)
        }

        "github_copilot" => {
            // Check if Copilot session token can be obtained
            let status = crate::features::ai::copilot::check_copilot_auth_status().await;
            if !status.connected {
                return Err(
                    "GitHub Copilot is not connected. Sign in via Device Flow first.".to_string(),
                );
            }

            let gh_token = crate::features::credentials::get_ai_key("github_copilot")
                .map_err(|_| "Copilot token not found in keyring".to_string())?;

            let session =
                crate::features::ai::copilot::get_internal_copilot_token(&gh_token).await?;

            let url = "https://api.individual.githubcopilot.com/models";
            let resp = client
                .get(url)
                .header("Authorization", format!("Bearer {}", session.token))
                .header("Editor-Version", "vscode/1.96.0")
                .send()
                .await;

            let mut list = Vec::new();
            if let Ok(r) = resp {
                if r.status().is_success() {
                    if let Ok(data) = r.json::<CopilotModelListResponse>().await {
                        if let Some(items) = data.data {
                            for item in items {
                                list.push(DynamicModelInfo {
                                    id: item.id.clone(),
                                    name: item.name.unwrap_or(item.id),
                                    description: Some(
                                        "GitHub Copilot Subscription Model".to_string(),
                                    ),
                                });
                            }
                        }
                    }
                }
            }

            if list.is_empty() {
                // Default models supported by Copilot
                list.push(DynamicModelInfo {
                    id: "gpt-4o".to_string(),
                    name: "GPT-4o (Copilot)".to_string(),
                    description: Some("OpenAI Flagship on Copilot".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "claude-3.5-sonnet".to_string(),
                    name: "Claude 3.5 Sonnet (Copilot)".to_string(),
                    description: Some("Anthropic Coding on Copilot".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "o3-mini".to_string(),
                    name: "o3-mini (Copilot)".to_string(),
                    description: Some("OpenAI Reasoning on Copilot".to_string()),
                });
                list.push(DynamicModelInfo {
                    id: "gpt-4o-mini".to_string(),
                    name: "GPT-4o Mini (Copilot)".to_string(),
                    description: Some("Lightweight Copilot".to_string()),
                });
            }

            Ok(list)
        }

        other => Err(format!(
            "Dynamic model fetching is not implemented for provider '{}'",
            other
        )),
    }
}
