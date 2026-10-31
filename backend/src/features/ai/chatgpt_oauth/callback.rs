use super::pending_login::PendingLogin;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const DENIED: &str = "ChatGPT authorization was declined. No session was activated.";

pub(super) fn parse(
    request: &str,
    pending: &PendingLogin,
) -> Result<Option<(String, String)>, String> {
    let mut lines = request.split("\r\n");
    let parts = lines
        .next()
        .unwrap_or("")
        .split_whitespace()
        .collect::<Vec<_>>();
    if parts.len() != 3
        || parts[0] != "GET"
        || !matches!(parts[2], "HTTP/1.1" | "HTTP/1.0")
        || !parts[1].starts_with('/')
    {
        return Ok(None);
    }
    let expected =
        reqwest::Url::parse(&pending.redirect).map_err(|_| crate::common::messages::failure("backend.ai.chatGptCallbackConfigInvalid", serde_json::json!({}), "Invalid callback configuration".into()))?;
    let hosts = lines
        .filter_map(|line| line.split_once(':'))
        .filter(|(name, _)| name.eq_ignore_ascii_case("host"))
        .map(|(_, value)| value.trim())
        .collect::<Vec<_>>();
    if hosts != [format!("127.0.0.1:{}", expected.port().unwrap_or(0))] {
        return Ok(None);
    }
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{}", parts[1]))
        .map_err(|_| crate::common::messages::failure("backend.ai.chatGptCallbackUrlInvalid", serde_json::json!({}), "Invalid callback URL".into()))?;
    if url.path() != "/auth/callback" || url.fragment().is_some() {
        return Ok(None);
    }
    let mut query = std::collections::HashMap::new();
    for (key, value) in url.query_pairs() {
        if query.insert(key.to_string(), value.to_string()).is_some() {
            return Ok(None);
        }
    }
    if query.get("state").map(String::as_str) != Some(&pending.state) {
        return Ok(None);
    }
    if query.contains_key("error") {
        return Err(DENIED.into());
    }
    let Some(code) = query
        .get("code")
        .filter(|s| !s.is_empty() && s.len() <= 4096 && !s.chars().any(char::is_control))
    else {
        return Ok(None);
    };
    let client = query.get("client_id").map(String::as_str);
    let client = if pending.profile.client_id == super::DYNAMIC_CLIENT {
        client
            .filter(|value| super::flow::issued_client(value))
            .ok_or(
                "Registration callback did not return an issued client ID. Start a new sign-in.",
            )?
    } else {
        if client.is_some_and(|value| value != pending.profile.client_id) {
            return Err(crate::common::messages::failure("backend.ai.chatGptCallbackClientIdMismatch", serde_json::json!({}), "Callback client ID did not match the selected registration".into()));
        }
        &pending.profile.client_id
    };
    Ok(Some((code.clone(), client.into())))
}
pub(super) async fn receive(
    listener: tokio::net::TcpListener,
    pending: &PendingLogin,
) -> Result<(String, String), String> {
    for _ in 0..32 {
        let (mut socket, peer) = listener
            .accept()
            .await
            .map_err(|_| crate::common::messages::failure("backend.ai.chatGptCallbackListenerStopped", serde_json::json!({}), "ChatGPT callback listener stopped".into()))?;
        if !peer.ip().is_loopback() {
            continue;
        }
        let read = async {
            let mut bytes = zeroize::Zeroizing::new(Vec::new());
            let mut chunk = [0u8; 1024];
            loop {
                let n = socket
                    .read(&mut chunk)
                    .await
                    .map_err(|_| crate::common::messages::failure("backend.ai.chatGptCallbackInterrupted", serde_json::json!({}), "Callback connection interrupted".into()))?;
                if n == 0 {
                    return Err(crate::common::messages::failure("backend.ai.chatGptCallbackHeadersIncomplete", serde_json::json!({}), "Incomplete callback headers".into()));
                }
                if bytes.len() + n > 16 * 1024 {
                    return Err(crate::common::messages::failure("backend.ai.chatGptCallbackHeadersLimit", serde_json::json!({}), "Callback headers exceeded limit".into()));
                }
                bytes.extend_from_slice(&chunk[..n]);
                if bytes.windows(4).any(|s| s == b"\r\n\r\n") {
                    break;
                }
            }
            Ok(parse(
                std::str::from_utf8(&bytes).map_err(|_| crate::common::messages::failure("backend.ai.chatGptCallbackEncodingInvalid", serde_json::json!({}), "Invalid callback encoding".into()))?,
                pending,
            ))
        };
        let result = match tokio::time::timeout(std::time::Duration::from_secs(3), read).await {
            Ok(Ok(value)) => value,
            _ => continue,
        };
        let accepted = matches!(&result, Ok(Some(_)));
        let body = if accepted {
            "Authorization received. Return to Stage0 to check the sign-in result. You may close this tab."
        } else {
            "This callback was not accepted. Return to Stage0 and retry if necessary."
        };
        let response = format!("HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", if accepted { "200 OK" } else { "400 Bad Request" }, body.len(), body);
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            socket.write_all(response.as_bytes()),
        )
        .await;
        match result {
            Ok(Some(result)) => return Ok(result),
            Err(error) => return Err(error),
            Ok(None) => {}
        }
    }
    Err("Too many unrelated requests reached the sign-in callback. Please retry.".into())
}
