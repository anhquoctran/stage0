use super::*;

fn pending() -> pending_login::PendingLogin {
    pending_login::PendingLogin::new(
        auth_profile::AuthProfile::new(),
        format!("urn:uuid:{}", uuid::Uuid::new_v4()),
        1455,
    )
}
fn request(pending: &pending_login::PendingLogin, query: &str) -> String {
    format!(
        "GET /auth/callback?state={}&{} HTTP/1.1\r\nHost: 127.0.0.1:1455\r\n\r\n",
        pending.state, query
    )
}
#[test]
fn authorization_uses_pkce_resource_host_identity_and_no_private_client_or_secret() {
    let mut pending = pending();
    let url = flow::authorization_url(&pending).unwrap();
    let query = url
        .query_pairs()
        .collect::<std::collections::HashMap<_, _>>();
    assert_eq!(query["client_id"], DYNAMIC_CLIENT);
    assert_eq!(query["agent_name_hint"], "Stage0");
    assert_eq!(query["resource"], RESOURCE);
    assert_eq!(query["redirect_uri"], "http://127.0.0.1:1455/auth/callback");
    assert_eq!(query["code_challenge_method"], "S256");
    assert!(query["scope"].contains("chatgpt.tokens.use.direct"));
    assert!(query.get("client_secret").is_none());
    assert_ne!(pending.state, pending.nonce);
    assert_ne!(pending.verifier, super::tests::pending().verifier);
    pending.profile.client_id = "oaiapp_fixture".into();
    let url = flow::authorization_url(&pending).unwrap();
    assert!(!url.query_pairs().any(|(key, _)| key == "agent_name_hint"));
}
#[test]
fn callback_requires_state_host_path_unique_parameters_and_the_correct_issued_client() {
    let mut pending = pending();
    assert_eq!(
        callback::parse(
            &request(&pending, "code=a%2Bb&client_id=oaiapp_fixture"),
            &pending
        )
        .unwrap(),
        Some(("a+b".into(), "oaiapp_fixture".into()))
    );
    for invalid in [
        request(&pending, "code=x&state=other&client_id=oaiapp_fixture"),
        request(&pending, "code=x&client_id=oaiapp_fixture").replace(&pending.state, "wrong"),
        request(&pending, "code=x&client_id=oaiapp_fixture")
            .replace("Host: 127.0.0.1", "Host: evil.example"),
        request(&pending, "code=x&client_id=oaiapp_fixture").replace("/auth/callback", "/callback"),
    ] {
        assert!(callback::parse(&invalid, &pending).unwrap().is_none());
    }
    assert!(callback::parse(&request(&pending, "code=x"), &pending).is_err());
    assert!(callback::parse(
        &request(
            &pending,
            "error=access_denied&code=x&client_id=oaiapp_fixture"
        ),
        &pending
    )
    .is_err());
    pending.profile.client_id = "oaiapp_fixture".into();
    assert!(callback::parse(
        &request(&pending, "code=x&client_id=oaiapp_other"),
        &pending
    )
    .is_err());
    assert_eq!(
        callback::parse(&request(&pending, "code=x"), &pending)
            .unwrap()
            .unwrap()
            .1,
        "oaiapp_fixture"
    );
}
#[tokio::test]
async fn real_loopback_ignores_unrelated_connections_and_does_not_claim_login_success() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let mut pending = pending();
    pending.redirect = format!("http://127.0.0.1:{port}/auth/callback");
    let valid = request(&pending, "code=fixture&client_id=oaiapp_fixture")
        .replace(":1455", &format!(":{port}"));
    let server = tokio::spawn(async move { callback::receive(listener, &pending).await });
    for text in [
        format!("GET /favicon.ico HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n"),
        valid,
    ] {
        let mut socket = tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .unwrap();
        socket.write_all(text.as_bytes()).await.unwrap();
        let mut response = String::new();
        socket.read_to_string(&mut response).await.unwrap();
        assert!(response.contains("Cache-Control: no-store"));
        assert!(!response.contains("Connected!"));
        assert!(!response.contains("code=fixture"));
    }
    assert_eq!(server.await.unwrap().unwrap().0, "fixture");
}
#[test]
fn identity_verification_checks_real_signatures_issuer_audience_expiry_nonce_and_algorithm() {
    let output = std::process::Command::new("node")
        .arg(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../scripts/fixtures/chatgpt-oidc.mjs"),
        )
        .output()
        .unwrap();
    assert!(output.status.success());
    let fixture: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let keys = serde_json::from_value(fixture["keys"].clone()).unwrap();
    let algorithms = vec!["RS256".into()];
    let valid = fixture["valid"].as_str().unwrap();
    assert_eq!(
        identity::verify(
            valid,
            &keys,
            "oaiapp_fixture",
            Some("fixture-nonce"),
            &algorithms
        )
        .unwrap()
        .sub,
        "fixture-subject"
    );
    for key in [
        "issuer",
        "audience",
        "nonce",
        "expired",
        "future",
        "future_iat",
        "missing_audience",
        "multiple_audience",
        "unknown_key",
        "hs256",
    ] {
        assert!(
            identity::verify(
                fixture[key].as_str().unwrap(),
                &keys,
                "oaiapp_fixture",
                Some("fixture-nonce"),
                &algorithms
            )
            .is_err(),
            "{key}"
        );
    }
    let mut tampered = valid.to_string();
    tampered.push('a');
    assert!(identity::verify(
        &tampered,
        &keys,
        "oaiapp_fixture",
        Some("fixture-nonce"),
        &algorithms
    )
    .is_err());
    assert!(identity::verify(
        valid,
        &keys,
        "oaiapp_fixture",
        Some("fixture-nonce"),
        &["ES256".into()]
    )
    .is_err());
}
fn session(scopes: &[&str]) -> stored_session::StoredSession {
    stored_session::StoredSession {
        access_token: "test-access-not-public".into(),
        refresh_token: Some("test-refresh-not-public".into()),
        id_token: Some("test-id-not-public".into()),
        scopes: scopes.iter().map(|s| s.to_string()).collect(),
        expires_at: chrono::Utc::now().timestamp() + 3600,
    }
}
#[test]
fn keyring_generations_round_trip_large_secrets_and_failed_writes_preserve_the_old_record() {
    test_keyring_entry::TestKeyringEntry::reset();
    test_keyring_entry::TestKeyringEntry::windows_limit(true);
    let old = "private 🔐".repeat(1000);
    secret_storage::write_chunked("fixture", &old).unwrap();
    assert_eq!(
        &**secret_storage::read_chunked("fixture", secret_storage::raw)
            .unwrap()
            .as_ref()
            .unwrap(),
        &old
    );
    let entries = test_keyring_entry::TestKeyringEntry::entries();
    for writes in [0, 1, 2, 15] {
        test_keyring_entry::TestKeyringEntry::fail_after(writes);
        assert!(secret_storage::write_chunked("fixture", &"replacement".repeat(1000)).is_err());
        assert_eq!(
            &**secret_storage::read_chunked("fixture", secret_storage::raw)
                .unwrap()
                .as_ref()
                .unwrap(),
            &old
        );
        assert_eq!(test_keyring_entry::TestKeyringEntry::entries(), entries);
    }
    secret_storage::write_chunked("fixture", "replacement").unwrap();
    assert_eq!(test_keyring_entry::TestKeyringEntry::entries(), 2);
    secret_storage::delete_chunked("fixture").unwrap();
    assert_eq!(test_keyring_entry::TestKeyringEntry::entries(), 0);
}
#[test]
fn separate_registrations_are_preserved_and_public_status_never_contains_credentials() {
    test_keyring_entry::TestKeyringEntry::reset();
    let mut catalog = AuthCatalog::load().unwrap();
    catalog.save().unwrap();
    let host = catalog.host_id.clone();
    let mut first = auth_profile::AuthProfile::new();
    first.client_id = "oaiapp_first".into();
    first.email = Some("same@example.test".into());
    first.subject = Some("first".into());
    catalog.commit(first.clone(), session(&["openid"])).unwrap();
    let mut second = first.clone();
    second.id = uuid::Uuid::new_v4().to_string();
    second.client_id = "oaiapp_second".into();
    second.secret = None;
    catalog
        .commit(
            second.clone(),
            session(&["resource.invoke", "chatgpt.tokens.use.direct"]),
        )
        .unwrap();
    let catalog = AuthCatalog::load().unwrap();
    assert_eq!(catalog.host_id, host);
    assert_eq!(catalog.profiles.len(), 2);
    let status = AuthRuntime::new().snapshot(&catalog).unwrap();
    assert!(status.connected && status.plan_usage_enabled);
    let public = serde_json::to_string(&status).unwrap();
    assert!(!public.contains("not-public") && !public.contains("oaiapp_"));
    let mut catalog = catalog;
    catalog.clear_session(&second.id).unwrap();
    assert!(!AuthRuntime::new().snapshot(&catalog).unwrap().connected);
    assert!(catalog
        .profiles
        .iter()
        .find(|p| p.id == first.id)
        .unwrap()
        .session()
        .unwrap()
        .is_some());
    assert_eq!(
        catalog
            .profiles
            .iter()
            .find(|p| p.id == second.id)
            .unwrap()
            .client_id,
        "oaiapp_second"
    );
}

#[test]
fn passive_status_never_reads_keyring_and_uses_only_explicitly_hydrated_public_metadata() {
    test_keyring_entry::TestKeyringEntry::reset();
    let mut runtime = AuthRuntime::new();
    for _ in 0..20 {
        let status = runtime.status();
        assert!(!status.credentials_loaded && !status.connected);
    }
    assert_eq!(test_keyring_entry::TestKeyringEntry::reads(), 0);
    let mut catalog = AuthCatalog::load().unwrap();
    let mut profile = auth_profile::AuthProfile::new();
    profile.client_id = "oaiapp_fixture".into();
    catalog
        .commit(
            profile.clone(),
            session(&["resource.invoke", "chatgpt.tokens.use.direct"]),
        )
        .unwrap();
    runtime.snapshot(&catalog).unwrap();
    let reads = test_keyring_entry::TestKeyringEntry::reads();
    assert!(runtime.status().credentials_loaded && runtime.status().connected);
    for _ in 0..100 {
        assert!(runtime.status().connected);
    }
    assert_eq!(test_keyring_entry::TestKeyringEntry::reads(), reads);
    runtime.forget_session(&profile.id);
    let status = runtime.status();
    assert!(!status.connected && !status.plan_usage_enabled);
    assert!(!status.profiles[0].signed_in);
    assert_eq!(test_keyring_entry::TestKeyringEntry::reads(), reads);
    assert!(!serde_json::to_string(&status)
        .unwrap()
        .contains("not-public"));
}
#[test]
fn granted_permissions_are_not_inferred_and_untrusted_endpoints_are_rejected() {
    assert!(!session(&["openid", "profile", "email"]).plan_usage());
    for url in [
        "http://auth.openai.com/key",
        "https://auth.openai.com.evil.example/key",
        "https://user@auth.openai.com/key",
        "https://auth.openai.com/key?secret=x",
    ] {
        assert!(discovery::Discovery::trusted_url(url).is_err());
    }
    assert!(
        discovery::Discovery::trusted_url("https://auth.openai.com/.well-known/jwks.json").is_ok()
    );
}
