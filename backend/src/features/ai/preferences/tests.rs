use super::*;
use std::cell::RefCell;

#[test]
fn mcp_runtime_resolver_returns_only_declared_keychain_values_to_native_callers() {
    let public_env = BTreeMap::from([("LOG_LEVEL".to_string(), "debug".to_string())]);
    let resolved = resolve_mcp_env_with_record(
        "server-a",
        &public_env,
        &["GITHUB_TOKEN".to_string()],
        |server_id| {
            assert_eq!(server_id, "server-a");
            Ok(Some(
                r#"{"GITHUB_TOKEN":"private-token","OTHER_SECRET":"not-requested"}"#.into(),
            ))
        },
    )
    .unwrap();
    assert_eq!(resolved["LOG_LEVEL"].as_str(), "debug");
    assert_eq!(resolved["GITHUB_TOKEN"].as_str(), "private-token");
    assert!(!resolved.contains_key("OTHER_SECRET"));
}

#[test]
fn mcp_runtime_resolver_fails_closed_when_a_secret_is_missing() {
    let error = resolve_mcp_env_with_record(
        "server-a",
        &BTreeMap::new(),
        &["GITHUB_TOKEN".to_string()],
        |_| Ok(Some(r#"{"OTHER_SECRET":"private-token"}"#.into())),
    )
    .unwrap_err();
    assert!(error.contains("missing from the OS keychain"));
    assert!(!error.contains("private-token"));
}

#[test]
fn mcp_secret_batch_uses_one_keychain_record_per_server_and_removes_selected_names() {
    let saved = RefCell::new(BTreeMap::from([(
        "server-a".to_string(),
        r#"{"API_TOKEN":"old-secret","LOG_LEVEL":"info"}"#.to_string(),
    )]));
    let updates = BTreeMap::from([
        (
            "server-a".to_string(),
            BTreeMap::from([(
                "API_TOKEN".to_string(),
                Zeroizing::new("new-secret".to_string()),
            )]),
        ),
        (
            "server-b".to_string(),
            BTreeMap::from([(
                "API_KEY".to_string(),
                Zeroizing::new("second-secret".to_string()),
            )]),
        ),
    ]);
    let removals = BTreeMap::from([("server-a".to_string(), vec!["LOG_LEVEL".to_string()])]);
    apply_mcp_env_changes(
        &updates,
        &removals,
        |server_id| Ok(saved.borrow().get(server_id).cloned()),
        |id, value| {
            let server_id = id.strip_prefix("mcp_server/").unwrap();
            if let Some(value) = value {
                saved.borrow_mut().insert(server_id.into(), value.into());
            } else {
                saved.borrow_mut().remove(server_id);
            }
            Ok(())
        },
    )
    .unwrap();
    let saved = saved.into_inner();
    let server_a: BTreeMap<String, String> = serde_json::from_str(&saved["server-a"]).unwrap();
    let server_b: BTreeMap<String, String> = serde_json::from_str(&saved["server-b"]).unwrap();
    assert_eq!(
        server_a,
        BTreeMap::from([("API_TOKEN".into(), "new-secret".into())])
    );
    assert_eq!(
        server_b,
        BTreeMap::from([("API_KEY".into(), "second-secret".into())])
    );
}

#[test]
fn mcp_secret_batch_rolls_back_all_servers_if_a_keychain_write_fails() {
    let original = BTreeMap::from([
        ("server-a".to_string(), r#"{"TOKEN":"old-a"}"#.to_string()),
        ("server-b".to_string(), r#"{"TOKEN":"old-b"}"#.to_string()),
    ]);
    let saved = RefCell::new(original.clone());
    let failed = RefCell::new(false);
    let updates = BTreeMap::from([
        (
            "server-a".to_string(),
            BTreeMap::from([("TOKEN".to_string(), Zeroizing::new("new-a".to_string()))]),
        ),
        (
            "server-b".to_string(),
            BTreeMap::from([(
                "TOKEN".to_string(),
                Zeroizing::new("reject-this-secret".to_string()),
            )]),
        ),
    ]);
    let error = apply_mcp_env_changes(
        &updates,
        &BTreeMap::new(),
        |server_id| Ok(saved.borrow().get(server_id).cloned()),
        |id, value| {
            let server_id = id.strip_prefix("mcp_server/").unwrap();
            if value.is_some_and(|secret| secret.contains("reject-this-secret"))
                && !*failed.borrow()
            {
                *failed.borrow_mut() = true;
                return Err("fixture failure".into());
            }
            if let Some(value) = value {
                saved.borrow_mut().insert(server_id.into(), value.into());
            } else {
                saved.borrow_mut().remove(server_id);
            }
            Ok(())
        },
    )
    .unwrap_err();
    assert!(error.contains("Previous values were restored"));
    assert!(!error.contains("reject-this-secret"));
    assert_eq!(*saved.borrow(), original);
}

#[test]
fn mcp_secret_batch_rejects_invalid_names_before_keychain_access() {
    let updates = BTreeMap::from([(
        "server-a".to_string(),
        BTreeMap::from([(
            "1BAD_NAME".to_string(),
            Zeroizing::new("secret".to_string()),
        )]),
    )]);
    let result = apply_mcp_env_changes(
        &updates,
        &BTreeMap::new(),
        |_| panic!("invalid secret changes must be rejected before keychain reads"),
        |_, _| panic!("invalid secret changes must be rejected before keychain writes"),
    );
    assert!(result.is_err());
}

#[test]
fn failed_key_batch_restores_previous_keys_without_returning_or_logging_them() {
    let saved = RefCell::new(BTreeMap::from([(
        "openai".to_string(),
        "previous-secret".to_string(),
    )]));
    let failed = RefCell::new(false);
    let keys = BTreeMap::from([
        ("openai".into(), Zeroizing::new("replacement".into())),
        ("xai_grok".into(), Zeroizing::new("reject".into())),
    ]);
    let result = apply_keys(
        &keys,
        &[],
        |provider| Ok(saved.borrow().get(provider).cloned()),
        |provider, key| {
            if key == Some("reject") && !*failed.borrow() {
                *failed.borrow_mut() = true;
                return Err("test".into());
            }
            if let Some(key) = key {
                saved.borrow_mut().insert(provider.into(), key.into());
            } else {
                saved.borrow_mut().remove(provider);
            }
            Ok(())
        },
    );
    assert!(result.unwrap_err().contains("Previous keys were restored"));
    assert_eq!(
        *saved.borrow(),
        BTreeMap::from([("openai".into(), "previous-secret".into())])
    );
}
#[test]
fn reserved_auth_credentials_cannot_be_modified_through_preferences() {
    let keys = BTreeMap::from([(
        "openai_subscription".into(),
        Zeroizing::new("not-an-api-key".into()),
    )]);
    assert!(apply_keys(
        &keys,
        &[],
        |_| panic!("must not read"),
        |_, _| panic!("must not write")
    )
    .is_err());
}
