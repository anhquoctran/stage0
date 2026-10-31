use super::{mcp_protocol as protocol, McpDiscoveryReport, McpDiscoveryRequest};
use serde_json::{json, Value};
use std::{collections::HashSet, time::Duration};

pub struct McpHttpClient {
    client: reqwest::Client,
    url: reqwest::Url,
    session: Option<String>,
    bytes: usize,
}

#[cfg(test)]
mod tests {
    use super::super::test_http_server::server;
    use super::*;
    fn request(url: String) -> McpDiscoveryRequest {
        McpDiscoveryRequest {
            connection_id: "fixture".into(),
            url,
            allow_network: true,
        }
    }
    fn initialize(version: &str) -> Value {
        json!({"body":json!({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":version,"capabilities":{"tools":{}},"serverInfo":{"name":"Fixture MCP","version":"1"},"instructions":"untrusted instructions must not enter the model"}}).to_string(),"session":"fixture-session"})
    }
    #[test]
    fn consent_and_safe_endpoints_are_checked_before_any_network_activity() {
        let mut cfg = request("http://localhost:1/mcp".into());
        cfg.allow_network = false;
        assert!(McpHttpClient::new(&cfg).is_err());
        cfg.allow_network = true;
        for url in [
            "http://remote.example/mcp",
            "https://user:secret@remote.example/mcp",
            "https://remote.example/mcp?token=secret",
            "https://remote.example/mcp#secret",
            "file:///tmp/mcp",
        ] {
            cfg.url = url.into();
            assert!(McpHttpClient::new(&cfg).is_err());
        }
    }
    #[tokio::test]
    async fn real_http_discovery_handles_json_sse_pagination_and_closes_without_calling_tools() {
        let first = json!({"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"submit_review","inputSchema":{"type":"object"},"annotations":{"readOnlyHint":true}}],"nextCursor":"next"}});
        let (url,requests)=server(vec![initialize(protocol::VERSION),json!({"status":202}),json!({"contentType":"text/event-stream","body":format!(": heartbeat\n\ndata: {first}\n\n")}),json!({"body":json!({"jsonrpc":"2.0","id":3,"result":{"tools":[{"name":"search","inputSchema":{"type":"object"}}]}}).to_string()}),json!({"status":202})]).await;
        let report = McpHttpClient::probe(&request(url)).await.unwrap();
        assert_eq!(report.tools.len(), 2);
        assert!(!report.attached_to_harness);
        assert_eq!(report.protocol_version, protocol::VERSION);
        assert_ne!(report.tools[0].namespaced_name, "submit_review");
        assert!(!serde_json::to_string(&report)
            .unwrap()
            .contains("untrusted instructions"));
        let requests = requests.await.unwrap();
        assert_eq!(requests.len(), 5);
        assert_eq!(requests[0]["body"]["params"]["capabilities"], json!({}));
        assert_eq!(requests[1]["body"]["method"], "notifications/initialized");
        assert_eq!(requests[3]["body"]["params"]["cursor"], "next");
        assert!(requests[4]["headers"]
            .as_str()
            .unwrap()
            .starts_with("delete /mcp "));
        for req in &requests[1..] {
            let headers = req["headers"].as_str().unwrap();
            assert!(
                headers.contains("mcp-session-id: fixture-session")
                    && headers.contains("mcp-protocol-version: 2025-11-25")
            );
        }
        let serialized = serde_json::to_string(&requests).unwrap();
        for forbidden in [
            "tools/call",
            "repoPath",
            "apiKey",
            "roots/list",
            "authorization:",
        ] {
            assert!(!serialized.contains(forbidden));
        }
    }
    #[tokio::test]
    async fn unsupported_versions_fail_and_close_the_temporary_session() {
        let (url, requests) = server(vec![initialize("2099-01-01"), json!({"status":202})]).await;
        assert!(McpHttpClient::probe(&request(url))
            .await
            .err()
            .unwrap()
            .contains("Unsupported MCP protocol"));
        assert_eq!(requests.await.unwrap().len(), 2);
    }
    #[tokio::test]
    async fn stateless_servers_do_not_receive_a_fabricated_session_or_delete() {
        let mut initialized = initialize(protocol::VERSION);
        initialized.as_object_mut().unwrap().remove("session");
        let (url, requests) = server(vec![
            initialized,
            json!({"status":202}),
            json!({"body":json!({"jsonrpc":"2.0","id":2,"result":{"tools":[]}}).to_string()}),
        ])
        .await;
        let report = McpHttpClient::probe(&request(url)).await.unwrap();
        assert!(report.tools.is_empty());
        let requests = requests.await.unwrap();
        assert_eq!(requests.len(), 3);
        assert!(!requests[2]["headers"]
            .as_str()
            .unwrap()
            .contains("mcp-session-id"));
    }
    #[tokio::test]
    async fn repeated_catalog_cursors_fail_without_returning_partial_success() {
        let page = |id| json!({"body":json!({"jsonrpc":"2.0","id":id,"result":{"tools":[],"nextCursor":"repeat"}}).to_string()});
        let (url, requests) = server(vec![
            initialize(protocol::VERSION),
            json!({"status":202}),
            page(2),
            page(3),
            json!({"status":202}),
        ])
        .await;
        assert!(McpHttpClient::probe(&request(url))
            .await
            .err()
            .unwrap()
            .contains("pagination cursor"));
        assert_eq!(requests.await.unwrap().len(), 5);
    }
    #[tokio::test]
    async fn authentication_redirects_and_rpc_errors_are_not_followed_or_exposed() {
        for status in [401, 302] {
            let (url,requests)=server(vec![json!({"status":status,"body":"fixture secret error body","location":"http://127.0.0.1:1/never-follow"})]).await;
            let error = McpHttpClient::probe(&request(url)).await.err().unwrap();
            assert!(error.contains(&status.to_string()) && !error.contains("fixture secret"));
            assert_eq!(requests.await.unwrap().len(), 1);
        }
    }
    #[tokio::test]
    async fn discovery_does_not_expose_a_general_rpc_or_accept_unbounded_catalogs() {
        let mut client = McpHttpClient::new(&request("http://127.0.0.1:1/mcp".into())).unwrap();
        assert!(client
            .post("tools/call", json!({"name":"delete_all"}), Some(1))
            .await
            .unwrap_err()
            .contains("not authorized"));
        let (url,requests)=server(vec![initialize(protocol::VERSION),json!({"status":202}),json!({"body":json!({"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"a","inputSchema":{}},{"name":"a","inputSchema":{}}]}}).to_string()}),json!({"status":202})]).await;
        assert!(McpHttpClient::probe(&request(url))
            .await
            .err()
            .unwrap()
            .contains("Duplicate"));
        requests.await.unwrap();
        let (url, requests) = server(vec![json!({"body":"x".repeat(257*1024)})]).await;
        assert!(McpHttpClient::probe(&request(url))
            .await
            .err()
            .unwrap()
            .contains("budget"));
        requests.await.unwrap();
    }
}

impl McpHttpClient {
    pub fn new(request: &McpDiscoveryRequest) -> Result<Self, String> {
        if !request.allow_network {
            return Err(crate::common::messages::failure(
                "backend.review.mcpConsentRequired",
                serde_json::json!({}),
                "Explicit discovery consent is required; no server was contacted".into(),
            ));
        }
        if request.connection_id.is_empty()
            || request.connection_id.len() > 128
            || request.connection_id.chars().any(char::is_control)
            || request.url.len() > 2048
        {
            return Err(crate::common::messages::failure(
                "backend.review.mcpIdentityOrUrlLengthInvalid",
                serde_json::json!({}),
                "Invalid MCP connection identity or URL length".into(),
            ));
        }
        let url = reqwest::Url::parse(request.url.trim()).map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpUrlInvalid",
                serde_json::json!({}),
                "Invalid MCP URL".into(),
            )
        })?;
        let local = matches!(
            url.host_str(),
            Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
        );
        if !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.host_str().is_none()
            || !(url.scheme() == "https" || local && url.scheme() == "http")
        {
            return Err(crate::common::messages::failure("backend.review.mcpUrlHttpsRequired", serde_json::json!({}), "MCP URL must use HTTPS (HTTP only on loopback), without credentials, query strings or fragments".into()));
        }
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|_| {
                crate::common::messages::failure(
                    "backend.review.mcpClientCreateFailed",
                    serde_json::json!({}),
                    "Could not create MCP client".into(),
                )
            })?;
        Ok(Self {
            client,
            url,
            session: None,
            bytes: 0,
        })
    }
    async fn post(
        &mut self,
        method: &str,
        params: Value,
        id: Option<u64>,
    ) -> Result<Value, String> {
        // This discovery client deliberately has no general RPC/tools/call API.
        if !matches!(
            method,
            "initialize" | "notifications/initialized" | "tools/list"
        ) {
            return Err(crate::common::messages::failure(
                "backend.review.mcpMethodUnauthorized",
                serde_json::json!({}),
                "MCP method is not authorized for discovery".into(),
            ));
        }
        let mut body = json!({"jsonrpc":"2.0","method":method,"params":params});
        if let Some(id) = id {
            body["id"] = json!(id);
        }
        let mut request = self
            .client
            .post(self.url.clone())
            .header("Accept", "application/json, text/event-stream")
            .json(&body);
        if method != "initialize" {
            request = request.header("MCP-Protocol-Version", protocol::VERSION);
        }
        if let Some(session) = &self.session {
            request = request.header("Mcp-Session-Id", session);
        }
        let mut response = request.send().await.map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpConnectionFailedOrTimeout",
                serde_json::json!({}),
                "MCP connection failed or timed out".into(),
            )
        })?;
        if !response.status().is_success() {
            return Err(crate::common::messages::failure(
                "backend.review.mcpDiscoveryHttpFailed",
                serde_json::json!({ "status": response.status().as_u16().to_string() }),
                format!("MCP discovery returned HTTP {}. No credentials were sent; OAuth/authenticated connectors are not implemented.", response.status().as_u16()),
            ));
        }
        if method == "initialize" {
            if let Some(session) = response.headers().get("Mcp-Session-Id") {
                let session = session.to_str().map_err(|_| {
                    crate::common::messages::failure(
                        "backend.review.mcpSessionHeaderInvalid",
                        serde_json::json!({}),
                        "Invalid MCP session header".into(),
                    )
                })?;
                if session.is_empty()
                    || session.len() > 512
                    || !session.bytes().all(|b| (0x21..=0x7e).contains(&b))
                {
                    return Err(crate::common::messages::failure(
                        "backend.review.mcpSessionHeaderInvalid",
                        serde_json::json!({}),
                        "Invalid MCP session header".into(),
                    ));
                }
                self.session = Some(session.into());
            }
        }
        if id.is_none() {
            return if response.status() == reqwest::StatusCode::ACCEPTED {
                Ok(json!({}))
            } else {
                Err("MCP notification was not accepted with HTTP 202".into())
            };
        }
        let id = id.unwrap();
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|s| s.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .trim();
        let sse = content_type == "text/event-stream";
        if !sse && content_type != "application/json" {
            return Err(crate::common::messages::failure(
                "backend.review.mcpResponseContentTypeUnsupported",
                serde_json::json!({}),
                "Unsupported MCP response content type".into(),
            ));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpResponseInterrupted",
                serde_json::json!({}),
                "MCP response interrupted".into(),
            )
        })? {
            self.bytes += chunk.len();
            if bytes.len() + chunk.len() > 256 * 1024 || self.bytes > 512 * 1024 {
                return Err(crate::common::messages::failure(
                    "backend.review.mcpResponseBudgetExceeded",
                    serde_json::json!({}),
                    "MCP discovery response budget exceeded".into(),
                ));
            }
            bytes.extend_from_slice(&chunk);
            if sse {
                if let Some(value) = protocol::sse_result(&bytes, id, false)? {
                    return Ok(value);
                }
            }
        }
        if sse {
            return protocol::sse_result(&bytes, id, true)?.ok_or_else(|| {
                crate::common::messages::failure(
                    "backend.review.mcpStreamEndedNoResponse",
                    serde_json::json!({}),
                    "MCP stream ended without a matching response".into(),
                )
            });
        }
        let message: Value = serde_json::from_slice(&bytes).map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpResponseJsonInvalid",
                serde_json::json!({}),
                "Invalid MCP response JSON".into(),
            )
        })?;
        protocol::result(&message, id)
    }
    async fn discover(&mut self, id: &str) -> Result<McpDiscoveryReport, String> {
        let initialized=self.post("initialize",json!({"protocolVersion":protocol::VERSION,"capabilities":{},"clientInfo":{"name":"stage0-discovery","version":env!("CARGO_PKG_VERSION")}}),Some(1)).await?;
        if initialized["protocolVersion"] != protocol::VERSION {
            return Err(crate::common::messages::failure("backend.review.mcpProtocolRevisionUnsupported", serde_json::json!({}), "Unsupported MCP protocol revision. This connector is pinned to 2025-11-25; it does not silently downgrade or claim newer revision support.".into()));
        }
        let name = initialized["serverInfo"]["name"]
            .as_str()
            .filter(|s| !s.is_empty() && s.len() <= 200)
            .ok_or_else(|| {
                crate::common::messages::failure(
                    "backend.review.mcpServerIdentityInvalid",
                    serde_json::json!({}),
                    "MCP server identity missing or invalid".into(),
                )
            })?;
        let version = initialized["serverInfo"]["version"]
            .as_str()
            .filter(|s| s.len() <= 100)
            .ok_or_else(|| {
                crate::common::messages::failure(
                    "backend.review.mcpServerVersionInvalid",
                    serde_json::json!({}),
                    "MCP server version missing or invalid".into(),
                )
            })?;
        if !initialized["capabilities"]["tools"].is_object() {
            return Err(crate::common::messages::failure(
                "backend.review.mcpToolsNotAdvertised",
                serde_json::json!({}),
                "MCP server does not advertise tool discovery".into(),
            ));
        }
        self.post("notifications/initialized", json!({}), None)
            .await?;
        let mut tools = Vec::new();
        let mut cursor = None;
        let mut cursors = HashSet::new();
        let mut names = HashSet::new();
        for page in 0..5 {
            let params = cursor
                .as_ref()
                .map(|c| json!({"cursor":c}))
                .unwrap_or(json!({}));
            let result = self.post("tools/list", params, Some(page + 2)).await?;
            for tool in protocol::catalog_page(id, &result)? {
                if !names.insert(tool.name.clone()) {
                    return Err(crate::common::messages::failure(
                        "backend.review.mcpDuplicateToolName",
                        serde_json::json!({}),
                        "Duplicate MCP tool name".into(),
                    ));
                }
                tools.push(tool);
            }
            if tools.len() > 100 {
                return Err(crate::common::messages::failure(
                    "backend.review.mcpCatalogLimitExceeded",
                    serde_json::json!({}),
                    "MCP catalog exceeds 100 tools".into(),
                ));
            }
            match result.get("nextCursor") {
                None | Some(Value::Null) => {
                    return Ok(McpDiscoveryReport {
                        connection_id: id.into(),
                        endpoint_fingerprint: protocol::fingerprint(self.url.as_str()),
                        catalog_fingerprint: protocol::fingerprint(
                            &serde_json::to_string(&tools).map_err(|_| {
                                crate::common::messages::failure(
                                    "backend.review.mcpCatalogFingerprintFailed",
                                    serde_json::json!({}),
                                    "Could not fingerprint MCP catalog".into(),
                                )
                            })?,
                        ),
                        protocol_version: protocol::VERSION.into(),
                        server_name: name.into(),
                        server_version: version.into(),
                        tools,
                        discovered_at: chrono::Utc::now().to_rfc3339(),
                        attached_to_harness: false,
                    })
                }
                Some(Value::String(next))
                    if !next.is_empty() && next.len() <= 1024 && cursors.insert(next.clone()) =>
                {
                    cursor = Some(next.clone())
                }
                _ => {
                    return Err(crate::common::messages::failure(
                        "backend.review.mcpPaginationCursorInvalid",
                        serde_json::json!({}),
                        "Invalid or repeated MCP pagination cursor".into(),
                    ))
                }
            }
        }
        Err("MCP discovery exceeds five catalog pages".into())
    }
    async fn close(&mut self) {
        if let Some(session) = self.session.take() {
            let _ = self
                .client
                .delete(self.url.clone())
                .header("Mcp-Session-Id", session)
                .header("MCP-Protocol-Version", protocol::VERSION)
                .timeout(Duration::from_secs(2))
                .send()
                .await;
        }
    }
    pub async fn probe(request: &McpDiscoveryRequest) -> Result<McpDiscoveryReport, String> {
        let mut client = Self::new(request)?;
        let outcome = tokio::time::timeout(
            Duration::from_secs(30),
            client.discover(&request.connection_id),
        )
        .await
        .map_err(|_| {
            crate::common::messages::failure(
                "backend.review.mcpDiscoveryDeadlineExceeded",
                serde_json::json!({}),
                "MCP discovery deadline exceeded".into(),
            )
        })
        .and_then(|v| v);
        client.close().await;
        outcome
    }
}
