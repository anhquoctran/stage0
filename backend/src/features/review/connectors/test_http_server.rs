use serde_json::{json, Value};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub async fn server(responses: Vec<Value>) -> (String, tokio::task::JoinHandle<Vec<Value>>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/mcp", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for response in responses {
            let (mut stream, _) = tokio::time::timeout(Duration::from_secs(5), listener.accept())
                .await
                .unwrap()
                .unwrap();
            let mut bytes = Vec::new();
            let mut chunk = [0; 4096];
            let (end, length) = loop {
                let n = stream.read(&mut chunk).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&chunk[..n]);
                if let Some(n) = bytes.windows(4).position(|v| v == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..n]).to_lowercase();
                    let length = headers
                        .lines()
                        .find_map(|s| {
                            s.strip_prefix("content-length:")
                                .map(|s| s.trim().parse::<usize>().unwrap())
                        })
                        .unwrap_or(0);
                    break (n + 4, length);
                }
                assert!(bytes.len() < 512 * 1024);
            };
            while bytes.len() < end + length {
                let n = stream.read(&mut chunk).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&chunk[..n]);
            }
            requests.push(json!({"headers":String::from_utf8_lossy(&bytes[..end]).to_lowercase(),"body":if length==0{Value::Null}else{serde_json::from_slice::<Value>(&bytes[end..end+length]).unwrap()}}));
            let body = response["body"].as_str().unwrap_or("");
            let status = response["status"].as_u64().unwrap_or(200);
            let content_type = response["contentType"]
                .as_str()
                .unwrap_or("application/json");
            let session = response["session"]
                .as_str()
                .map(|s| format!("Mcp-Session-Id: {s}\r\n"))
                .unwrap_or_default();
            let location = response["location"]
                .as_str()
                .map(|s| format!("Location: {s}\r\n"))
                .unwrap_or_default();
            let _=stream.write_all(format!("HTTP/1.1 {status} Fixture\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n{session}{location}Connection: close\r\n\r\n{body}",body.len()).as_bytes()).await;
        }
        requests
    });
    (url, task)
}
