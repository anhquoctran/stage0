use super::engine::{MAX_DECODE_RECOVERIES, MAX_PROVIDER_RETRIES, MAX_REVIEW_TURNS};
use super::prompt::{build_system_prompt, reviewer_role_prompt};
use super::*;
use crate::features::review::provider;
use crate::features::review::{persistence::test_database, test_repo::TestRepo};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn server(
    responses: Vec<serde_json::Value>,
) -> (String, tokio::task::JoinHandle<Vec<serde_json::Value>>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for response in responses {
            let (mut stream, _) = tokio::time::timeout(Duration::from_secs(10), listener.accept())
                .await
                .unwrap()
                .unwrap();
            let mut bytes = Vec::new();
            let mut chunk = [0; 4096];
            let (header_end, length) = loop {
                let count = stream.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
                if let Some(pos) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                    let header = String::from_utf8_lossy(&bytes[..pos]).to_lowercase();
                    let length = header
                        .lines()
                        .find_map(|line| {
                            line.strip_prefix("content-length:")
                                .map(|v| v.trim().parse::<usize>().unwrap())
                        })
                        .unwrap();
                    break (pos + 4, length);
                }
                assert!(bytes.len() < 1024 * 1024);
            };
            while bytes.len() < header_end + length {
                let count = stream.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
            }
            requests.push(serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap());
            let (body, content_type) = if let Some(events) = response["fixtureSseEvents"].as_array()
            {
                (
                    events
                        .iter()
                        .map(|event| format!("data: {event}\r\n\r\n"))
                        .collect::<String>(),
                    "text/event-stream",
                )
            } else {
                (response.to_string(), "application/json")
            };
            let status = response["fixtureHttpStatus"].as_u64().unwrap_or(200);
            stream.write_all(format!("HTTP/1.1 {status} Fixture\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).as_bytes()).await.unwrap();
        }
        requests
    });
    (address, task)
}
fn reply(name: &str, args: serde_json::Value) -> serde_json::Value {
    json!({"done":true,"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":name,"arguments":args}}]},"prompt_eval_count":10,"eval_count":5})
}
fn prose_reply() -> serde_json::Value {
    json!({"done":true,"message":{"role":"assistant","content":"I will inspect the changes."},"prompt_eval_count":10,"eval_count":5})
}
fn config(url: String) -> ReviewRequest {
    ReviewRequest {
        session_id: "session".into(),
        provider: "ollama".into(),
        auth_mode: "api_key".into(),
        model: "fixture".into(),
        reasoning_effort: None,
        fast_mode: false,
        execution_mode: "provider".into(),
        acp_agent: None,
        acp_config_options: None,
        reviewer_id: None,
        reviewer_name: None,
        reply_discussion_id: None,
        reviewer_role: None,
        base_url: url,
        instructions: String::new(),
        allow_remote: false,
        generate_description: false,
    }
}

mod acp;
mod action_errors;
mod coverage;
mod discussion_fixture;
mod discussion_security;
mod http;
mod injection;
mod policy;
