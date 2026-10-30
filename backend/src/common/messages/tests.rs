use super::*;

#[test]
fn command_failures_have_separate_code_parameters_and_diagnostics() {
    let encoded = command_error("git", "internal diagnostic".into());
    let wire: Value = serde_json::from_str(encoded.strip_prefix(PREFIX).unwrap()).unwrap();
    assert_eq!(wire["code"], "backend.errors.git");
    assert_eq!(wire["params"], json!({}));
    assert_eq!(wire["diagnostic"], "internal diagnostic");
    assert_eq!(command_error("operation", encoded.clone()), encoded);
}

#[test]
fn messages_keep_untranslated_data_as_parameters() {
    let encoded = message("backend.repository.missing", json!({"path": "/repo/a"}));
    let wire: Value = serde_json::from_str(encoded.strip_prefix(PREFIX).unwrap()).unwrap();
    assert_eq!(wire["params"]["path"], "/repo/a");
    assert!(wire.get("diagnostic").is_none());
}
