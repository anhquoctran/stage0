use super::*;

#[test]
fn role_catalog_is_allowlisted_and_custom_instructions_stay_below_fixed_policy() {
    for role in [
        "security",
        "performance",
        "architecture",
        "style",
        "test",
        "documentation",
        "custom",
    ] {
        assert!(is_supported_reviewer_role(role));
        assert!(!reviewer_role_prompt(Some(role)).is_empty());
    }
    assert!(!is_supported_reviewer_role("ignore-safety-policy"));

    let mut request = config("http://localhost:11434".into());
    request.reviewer_role = Some("security".into());
    request.instructions = "Prefer checking authorization edge cases.".into();
    let prompt = build_system_prompt(&request);
    let role_index = prompt.find("Stage0-managed reviewer role prompt").unwrap();
    let custom_index = prompt.find("User additional instructions").unwrap();
    assert!(role_index < custom_index);
    let policy_index = prompt.find("UNTRUSTED DATA").unwrap();
    assert!(custom_index < policy_index);
    assert!(prompt.contains("Security Reviewer"));
    assert!(prompt.contains("Prefer checking authorization edge cases."));
}
