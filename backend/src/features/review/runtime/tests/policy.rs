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
    assert!(prompt.contains("UNTRUSTED DATA"));
    assert!(role_index < prompt.find("UNTRUSTED DATA").unwrap());
    assert!(prompt.contains("Security Reviewer"));
    assert!(!prompt.contains(&request.instructions));
    let preferences = super::super::prompt::review_preferences(&request);
    assert_eq!(preferences["text"], request.instructions);
    assert_eq!(preferences["authority"], "review_preferences_only");
}
