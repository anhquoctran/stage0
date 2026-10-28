use super::jsonc_patch::merge_object;
use super::migration::sanitize_value;
use super::schema::validate_schema;
use super::secrets::reject_secrets;
use super::storage::revision;
use super::validation::{parse_and_validate, strict_jsonc_options};
use super::{PreferencesManager, DEFAULT_PREFERENCES, PREFERENCES_FILE};
use jsonc_parser::cst::CstRootNode;
use serde_json::json;
use serde_json::Value;
use std::{fs, path::Path};

#[test]
fn cst_patch_preserves_comments_unknown_fields_and_jsonc_format() {
    let source = "{\n  // preserve me\n  \"schemaVersion\": 1,\n  \"general\": {\n    \"showInlineBlame\": true,\n    \"futureOption\": 7,\n  },\n  \"unknown\": \"keep\",\n  \"appearance\": {}, \"ai\": {}, \"reviewers\": [], \"sandbox\": {}, \"git\": {}, \"notifications\": {}, \"gitCredentials\": []\n}";
    let root = CstRootNode::parse(source, &strict_jsonc_options()).unwrap();
    let patch = json!({"general": {"showInlineBlame": false}});
    merge_object(&root.object_value().unwrap(), patch.as_object().unwrap()).unwrap();
    let result = root.to_string();
    assert!(result.contains("// preserve me"));
    assert!(result.contains("\"futureOption\": 7"));
    assert!(result.contains("\"unknown\": \"keep\""));
    assert!(result.contains("\"showInlineBlame\": false"));
}

#[test]
fn nested_delete_markers_are_not_written_when_adding_an_object() {
    let root = CstRootNode::parse(DEFAULT_PREFERENCES, &strict_jsonc_options()).unwrap();
    let patch = json!({
        "ai": {
            "aiConfig": {
                "provider": "openai",
                "model": "gpt-custom",
                "authMode": {"$stage0Delete": true},
                "cliType": {"$stage0Delete": true}
            }
        }
    });

    merge_object(&root.object_value().unwrap(), patch.as_object().unwrap()).unwrap();

    let content = root.to_string();
    let settings = parse_and_validate(&content).unwrap();
    assert_eq!(settings["ai"]["aiConfig"]["provider"], "openai");
    assert_eq!(settings["ai"]["aiConfig"]["model"], "gpt-custom");
    assert!(settings["ai"]["aiConfig"].get("authMode").is_none());
    assert!(settings["ai"]["aiConfig"].get("cliType").is_none());
    assert!(!content.contains("$stage0Delete"));
}

#[test]
fn strict_jsonc_accepts_comments_and_trailing_commas_but_not_json5() {
    let valid = "{\"schemaVersion\":1, // ok\n \"general\":{},\"appearance\":{},\"ai\":{},\"reviewers\":[],\"sandbox\":{},\"git\":{},\"notifications\":{},\"gitCredentials\":[],}";
    assert!(parse_and_validate(valid).is_ok());
    assert!(CstRootNode::parse("{schemaVersion: 1}", &strict_jsonc_options()).is_err());
    assert!(CstRootNode::parse("{'schemaVersion': 1}", &strict_jsonc_options()).is_err());
}

#[test]
fn ui_font_preferences_are_optional_validated_and_round_trip_through_jsonc() {
    let mut settings = parse_and_validate(DEFAULT_PREFERENCES).unwrap();
    assert_eq!(
        settings["appearance"]["uiFont"]["fontFamily"],
        "IBM Plex Sans"
    );
    settings["appearance"]
        .as_object_mut()
        .unwrap()
        .remove("uiFont");
    assert!(validate_schema(&settings).is_ok());
    for invalid in [
        json!(false),
        json!({"fontFamily": 42}),
        json!({"fontFamily": ""}),
    ] {
        settings["appearance"]["uiFont"] = invalid;
        assert!(validate_schema(&settings).is_err());
    }
    let root = CstRootNode::parse(DEFAULT_PREFERENCES, &strict_jsonc_options()).unwrap();
    let patch = json!({"appearance": {"uiFont": {"fontFamily": "Inter"}}});
    merge_object(&root.object_value().unwrap(), patch.as_object().unwrap()).unwrap();
    let saved = parse_and_validate(&root.to_string()).unwrap();
    assert_eq!(saved["appearance"]["uiFont"]["fontFamily"], "Inter");
    assert_eq!(
        saved["appearance"]["viewerFont"],
        settings["appearance"]["viewerFont"]
    );
}

#[test]
fn app_and_agent_languages_are_limited_to_the_supported_catalog() {
    let mut settings = parse_and_validate(DEFAULT_PREFERENCES).unwrap();
    assert_eq!(settings["appearance"]["language"], "en");
    assert_eq!(settings["ai"]["agentOutputLanguage"], "follow-app");
    assert_eq!(super::supported_language::SUPPORTED_APP_LANGUAGES.len(), 14);

    for language in super::supported_language::SUPPORTED_APP_LANGUAGES {
        settings["appearance"]["language"] = json!(language);
        settings["ai"]["agentOutputLanguage"] = json!(language);
        assert!(
            validate_schema(&settings).is_ok(),
            "locale {language} should validate"
        );
    }
    settings["appearance"]["language"] = json!("en-US");
    assert!(validate_schema(&settings).is_err());
    settings["appearance"]["language"] = json!("en");
    settings["ai"]["agentOutputLanguage"] = json!("system");
    assert!(validate_schema(&settings).is_err());
}

#[test]
fn schema_validation_rejects_wrong_types_ranges_and_malformed_records() {
    let valid = json!({
        "schemaVersion": 1,
        "general": {"showInlineBlame": true},
        "appearance": {"themeMode": "dark", "viewerFont": {"fontSize": 13}},
        "ai": {"aiConfig": {"provider": "openai", "temperature": 0.2}},
        "reviewers": [],
        "sandbox": {"type": "in_memory"},
        "git": {"binaryPath": "git"},
        "notifications": {"channels": {"gitSync": false}},
        "gitCredentials": []
    });
    assert!(validate_schema(&valid).is_ok());

    let mut acp_reviewer = valid.clone();
    acp_reviewer["reviewers"] = json!([{
        "id": "custom-bot-acp-reviewer",
        "name": "ACP Reviewer",
        "tagline": "ACP tool-based review",
        "description": "Reviews through a configured ACP agent",
        "category": "security",
        "avatarEmoji": "🔍",
        "customInstructions": "",
        "enabled": true,
        "provider": "global_default",
        "model": "global_default",
        "acpAgentId": "codex-acp",
        "allowAcpSourceTransfer": true,
        "acpConfigOptions": {"model":"gpt-6-luna","reasoning_effort":"high","fast-mode":true}
    }]);
    assert!(validate_schema(&acp_reviewer).is_ok());

    let mut malformed_acp_options = acp_reviewer.clone();
    malformed_acp_options["reviewers"][0]["acpConfigOptions"] = json!({"fast-mode": ["true"]});
    assert!(validate_schema(&malformed_acp_options).is_err());

    let mut wrong_type = valid.clone();
    wrong_type["general"]["showInlineBlame"] = json!("true");
    assert!(validate_schema(&wrong_type).is_err());

    let mut out_of_range = valid.clone();
    out_of_range["ai"]["aiConfig"]["temperature"] = json!(3.0);
    assert!(validate_schema(&out_of_range).is_err());

    let mut malformed_credential = valid;
    malformed_credential["gitCredentials"] = json!([{"id":"credential-1"}]);
    assert!(validate_schema(&malformed_credential).is_err());

    let secret_mcp_env = json!({
        "schemaVersion": 1,
        "general": {}, "appearance": {},
        "ai": {"mcpServers": [{
            "id": "github", "name": "GitHub", "type": "stdio", "command": "npx",
            "args": [], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "not-written"}, "enabled": true
        }]},
        "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
    });
    assert!(validate_schema(&secret_mcp_env).is_err());

    let keychain_backed_mcp_env = json!({
        "schemaVersion": 1,
        "general": {}, "appearance": {},
        "ai": {"mcpServers": [{
            "id": "github", "name": "GitHub", "type": "stdio", "command": "npx",
            "args": [], "env": {}, "secretEnvKeys": ["GITHUB_PERSONAL_ACCESS_TOKEN"], "enabled": true
        }]},
        "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
    });
    assert!(validate_schema(&keychain_backed_mcp_env).is_ok());
    let mut duplicate_secret_env_names = keychain_backed_mcp_env.clone();
    duplicate_secret_env_names["ai"]["mcpServers"][0]["secretEnvKeys"] = json!(["TOKEN", "TOKEN"]);
    assert!(validate_schema(&duplicate_secret_env_names).is_err());

    let api_key = json!({
        "schemaVersion": 1, "general": {}, "appearance": {},
        "ai": {"aiConfig": {"apiKey": "plaintext"}},
        "reviewers": [], "sandbox": {}, "git": {}, "notifications": {}, "gitCredentials": []
    });
    assert!(validate_schema(&api_key).is_err());
}

#[test]
fn secret_fields_are_rejected_and_migration_removes_them() {
    let secret = json!({ "apiKey": "sk-secret" });
    assert!(reject_secrets(&secret, "").is_err());
    let sanitized =
        sanitize_value(&json!({"apiKey":"secret", "model":"gpt", "nested":{"password":"x"}}));
    assert_eq!(sanitized, json!({"model":"gpt", "nested":{}}));
}

#[test]
fn first_run_migration_keeps_supported_values_and_never_writes_legacy_secrets() {
    let directory = std::env::temp_dir().join(format!(
        "stage0-preferences-migration-{}",
        uuid::Uuid::new_v4()
    ));
    let manager = PreferencesManager::new(directory.clone()).unwrap();
    let legacy = json!({
        "general": {"showInlineBlame": false},
        "ai": {
            "aiConfig": {"provider":"openai", "model":"gpt-custom", "apiKey":"sk-legacy-secret"},
            "mcpServers": [{
                "id":"github", "name":"GitHub", "type":"stdio", "command":"npx",
                "args":[], "env":{"GITHUB_TOKEN":"ghp-legacy-secret", "LOG_LEVEL":"debug"}, "enabled":true
            }]
        },
        "reviewers": []
    });

    let migrated = manager.initialize(legacy, None).unwrap();
    let settings = migrated.settings.unwrap();
    assert_eq!(settings["general"]["showInlineBlame"], false);
    assert_eq!(settings["ai"]["aiConfig"]["model"], "gpt-custom");
    assert!(settings["ai"]["aiConfig"].get("apiKey").is_none());
    assert_eq!(settings["ai"]["mcpServers"][0]["env"]["LOG_LEVEL"], "debug");
    assert!(settings["ai"]["mcpServers"][0]["env"]
        .get("GITHUB_TOKEN")
        .is_none());
    assert_eq!(
        settings["ai"]["mcpServers"][0]["secretEnvKeys"],
        json!(["GITHUB_TOKEN"])
    );
    assert!(!migrated.content.contains("sk-legacy-secret"));
    assert!(!migrated.content.contains("ghp-legacy-secret"));
    let _ = fs::remove_dir_all(directory);
}

#[test]
fn invalid_file_uses_last_known_good_for_runtime_without_overwriting_editor_text() {
    let directory =
        std::env::temp_dir().join(format!("stage0-preferences-{}", uuid::Uuid::new_v4()));
    let manager = PreferencesManager::new(directory.clone()).unwrap();
    let initial = manager.initialize(Value::Null, None).unwrap();
    let patched = manager
        .patch(
            json!({"general":{"showInlineBlame":false}}),
            initial.revision,
        )
        .unwrap();

    let invalid = "{ not valid JSONC";
    fs::write(directory.join(PREFERENCES_FILE), invalid).unwrap();
    let recovered = manager.read().unwrap();

    assert_eq!(recovered.content, invalid);
    assert!(recovered.validation_error.is_some());
    assert_eq!(
        recovered.settings.as_ref().unwrap()["general"]["showInlineBlame"],
        false
    );
    assert_eq!(
        fs::read_to_string(directory.join(PREFERENCES_FILE)).unwrap(),
        invalid
    );

    let saved = manager
        .save(DEFAULT_PREFERENCES.to_string(), recovered.revision)
        .unwrap();
    assert!(saved.validation_error.is_none());
    assert_eq!(saved.settings.unwrap()["general"]["showInlineBlame"], true);
    assert_ne!(patched.revision, saved.revision);
    let _ = fs::remove_dir_all(directory);
}

#[test]
fn concurrent_managers_cannot_overwrite_the_same_revision() {
    use std::sync::{Arc, Barrier};

    let directory =
        std::env::temp_dir().join(format!("stage0-preferences-lock-{}", uuid::Uuid::new_v4()));
    let first_manager = PreferencesManager::new(directory.clone()).unwrap();
    let initial = first_manager.initialize(Value::Null, None).unwrap();
    let second_manager = PreferencesManager::new(directory.clone()).unwrap();
    let barrier = Arc::new(Barrier::new(3));

    let first_barrier = barrier.clone();
    let first_revision = initial.revision.clone();
    let first = std::thread::spawn(move || {
        first_barrier.wait();
        first_manager.patch(json!({"general":{"showInlineBlame":false}}), first_revision)
    });

    let second_barrier = barrier.clone();
    let second_revision = initial.revision;
    let second = std::thread::spawn(move || {
        second_barrier.wait();
        second_manager.patch(json!({"appearance":{"themeMode":"dark"}}), second_revision)
    });

    barrier.wait();
    let results = [first.join().unwrap(), second.join().unwrap()];
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|result| result
                .as_ref()
                .is_err_and(|error| error.contains("changed outside")))
            .count(),
        1
    );
    let latest = second_manager_for_test(&directory).read().unwrap();
    assert!(matches!(
        latest.settings.unwrap()["general"]["showInlineBlame"].as_bool(),
        Some(false | true)
    ));
    let _ = fs::remove_dir_all(directory);
}

fn second_manager_for_test(directory: &Path) -> PreferencesManager {
    PreferencesManager::new(directory.to_path_buf()).unwrap()
}

#[test]
fn revision_is_content_sensitive() {
    assert_ne!(revision("{}"), revision("{ }"));
}

#[test]
fn read_and_legacy_credentials_auto_initialize_when_missing() {
    let directory = std::env::temp_dir().join(format!(
        "stage0-preferences-missing-{}",
        uuid::Uuid::new_v4()
    ));
    let manager = PreferencesManager::new(directory.clone()).unwrap();
    let (creds, rev) = manager.legacy_git_credentials().unwrap();
    assert!(creds.is_none());
    assert!(rev.is_empty());

    let doc = manager.read().unwrap();
    assert!(doc.migrated);
    assert!(doc.settings.is_some());
    assert_eq!(doc.settings.as_ref().unwrap()["schemaVersion"], 1);
    assert!(directory.join(PREFERENCES_FILE).exists());

    let _ = fs::remove_dir_all(directory);
}

#[test]
fn initialize_falls_back_to_defaults_on_corrupt_legacy_data() {
    let directory = std::env::temp_dir().join(format!(
        "stage0-preferences-corrupt-{}",
        uuid::Uuid::new_v4()
    ));
    let manager = PreferencesManager::new(directory.clone()).unwrap();
    let corrupt_legacy = json!({
        "schemaVersion": "not a number",
        "general": false,
    });
    let doc = manager.initialize(corrupt_legacy, None).unwrap();
    assert!(doc.settings.is_some());
    assert_eq!(doc.settings.as_ref().unwrap()["schemaVersion"], 1);
    assert_eq!(
        doc.settings.as_ref().unwrap()["general"]["showInlineBlame"],
        true
    );

    let _ = fs::remove_dir_all(directory);
}

#[test]
fn linux_title_bar_mode_is_optional_and_rejects_unsupported_values() {
    let mut settings = parse_and_validate(DEFAULT_PREFERENCES).unwrap();
    assert_eq!(settings["appearance"]["linuxTitleBar"], "system");
    settings["appearance"]
        .as_object_mut()
        .unwrap()
        .remove("linuxTitleBar");
    assert!(validate_schema(&settings).is_ok());
    for mode in [json!("system"), json!("custom")] {
        settings["appearance"]["linuxTitleBar"] = mode;
        assert!(validate_schema(&settings).is_ok());
    }
    for mode in [json!("auto"), json!(true), json!(42)] {
        settings["appearance"]["linuxTitleBar"] = mode;
        assert!(validate_schema(&settings).is_err());
    }
}
