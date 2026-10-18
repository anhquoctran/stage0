use super::CodexAuthStatus;
use serde_json::{json, Value};

pub fn request(id: u64, method: &str, params: Value) -> Result<Value, String> {
    if !matches!(
        method,
        "initialize"
            | "account/read"
            | "account/login/start"
            | "account/login/cancel"
            | "account/logout"
    ) {
        return Err(
            "Only Codex authentication RPCs are allowed; inference and tool methods are disabled"
                .into(),
        );
    }
    if method == "account/login/start" && params != json!({"type":"chatgptDeviceCode"}) {
        return Err("Only managed ChatGPT device-code authentication is supported".into());
    }
    Ok(json!({"id":id,"method":method,"params":params}))
}

pub fn device_instructions(result: &Value, status: &mut CodexAuthStatus) -> Result<(), String> {
    if result["type"] != "chatgptDeviceCode" {
        return Err("Installed Codex does not support the requested device-code flow; update the official Codex CLI".into());
    }
    let login = result["loginId"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 200 && !s.chars().any(char::is_control))
        .ok_or("Missing Codex login ID")?;
    let code = result["userCode"]
        .as_str()
        .filter(|s| {
            (4..=64).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
        .ok_or("Invalid Codex user code")?;
    let url = result["verificationUrl"]
        .as_str()
        .ok_or("Missing Codex verification URL")?;
    let parsed = reqwest::Url::parse(url).map_err(|_| "Invalid Codex verification URL")?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("auth.openai.com")
        || parsed.path() != "/codex/device"
        || parsed.port().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("Refusing an unexpected device-code verification destination".into());
    }
    status.phase = "pending".into();
    status.login_id = Some(login.into());
    status.user_code = Some(code.into());
    status.verification_url = Some(parsed.into());
    status.deadline_at = Some((chrono::Utc::now() + chrono::Duration::minutes(10)).to_rfc3339());
    Ok(())
}

pub fn account(result: &Value, status: &mut CodexAuthStatus) -> Result<bool, String> {
    let account = result
        .get("account")
        .ok_or("Codex did not return an account state")?;
    status.clear_pending();
    status.account_email = None;
    status.plan_type = None;
    if account.is_null() {
        status.phase = "signed_out".into();
        return Ok(false);
    }
    if account["type"] != "chatgpt" {
        return Err("The isolated Codex profile is not signed in with ChatGPT; API-key login is not subscription login".into());
    }
    status.account_email = account["email"]
        .as_str()
        .filter(|s| s.len() <= 254 && !s.chars().any(char::is_control))
        .map(str::to_string);
    status.plan_type = account["planType"]
        .as_str()
        .filter(|s| s.len() <= 80 && !s.chars().any(char::is_control))
        .map(str::to_string);
    status.phase = "signed_in".into();
    Ok(true)
}

pub fn login_completed(message: &Value, login_id: &str) -> Option<bool> {
    if message["method"] == "account/login/completed"
        && message["params"]["loginId"].as_str() == Some(login_id)
    {
        message["params"]["success"].as_bool()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn auth_only_surface_cannot_start_threads_or_supply_external_tokens() {
        for method in [
            "thread/start",
            "turn/start",
            "item/tool/call",
            "account/chatgptAuthTokens/refresh",
        ] {
            assert!(request(1, method, json!({})).is_err());
        }
        assert!(request(
            1,
            "account/login/start",
            json!({"type":"chatgptAuthTokens","accessToken":"fixture"})
        )
        .is_err());
        assert!(request(
            1,
            "account/login/start",
            json!({"type":"chatgptDeviceCode"})
        )
        .is_ok());
    }
    #[test]
    fn device_codes_are_ephemeral_and_verification_destinations_are_pinned() {
        let mut status = CodexAuthStatus::default();
        let result = json!({"type":"chatgptDeviceCode","loginId":"attempt","userCode":"ABCD-1234","verificationUrl":"https://auth.openai.com/codex/device"});
        device_instructions(&result, &mut status).unwrap();
        assert_eq!(status.phase, "pending");
        for url in [
            "https://evil.example/codex/device",
            "https://auth.openai.com.evil.example/codex/device",
            "http://auth.openai.com/codex/device",
            "https://auth.openai.com/codex/device?token=fixture",
        ] {
            let mut bad = result.clone();
            bad["verificationUrl"] = json!(url);
            assert!(device_instructions(&bad, &mut status).is_err());
        }
        assert!(login_completed(&json!({"method":"account/login/completed","params":{"loginId":"other","success":true}}),"attempt").is_none());
        assert_eq!(
            login_completed(
                &json!({"method":"account/login/completed","params":{"loginId":"attempt","success":false}}),
                "attempt"
            ),
            Some(false)
        );
        assert!(!account(&json!({"account":null}), &mut status).unwrap());
        assert!(status.user_code.is_none());
        assert!(account(&json!({"account":{"type":"apiKey"}}), &mut status).is_err());
        assert!(account(
            &json!({"account":{"type":"chatgpt","email":"fixture@example.test","planType":"plus"}}),
            &mut status
        )
        .unwrap());
        assert_eq!(status.phase, "signed_in");
        assert_eq!(status.plan_type.as_deref(), Some("plus"));
        assert!(status.user_code.is_none());
        assert!(!serde_json::to_string(&status).unwrap().contains("loginId"));
    }
}
