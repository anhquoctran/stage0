//! Advisory screening only. These signals never authorize tools or prove safety.
pub fn flags(text: &str) -> Vec<&'static str> {
    let mut flags = Vec::new();
    let normalized = text.chars().take(32_000).collect::<String>().to_lowercase();
    let folded = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    if [
        "ignore all previous instructions",
        "ignore previous instructions",
        "disregard previous instructions",
        "override the system prompt",
        "b\u{1ecf} qua m\u{1ecd}i ch\u{1ec9} d\u{1eab}n",
        "b\u{1ecf} qua t\u{1ea5}t c\u{1ea3} h\u{1b0}\u{1edb}ng d\u{1eab}n",
    ]
    .iter()
    .any(|phrase| folded.contains(phrase))
    {
        flags.push("policy_override_language");
    }
    if [
        "<|im_start|>system",
        "[inst]",
        "</system>",
        "\nsystem:",
        "\ndeveloper:",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
    {
        flags.push("role_spoofing_marker");
    }
    if text.chars().any(|ch| matches!(ch, '\u{200b}' | '\u{200c}' | '\u{200d}' | '\u{2060}' | '\u{feff}' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}' | '\u{e0000}'..='\u{e007f}')) {
        flags.push("invisible_or_directional_characters");
    }
    flags
}

#[cfg(test)]
mod tests {
    #[test]
    fn screening_is_advisory_and_does_not_rewrite_security_examples() {
        for benign in [
            "Review system requirements",
            "Check secret redaction and SQL injection",
            "Please recheck the fix",
        ] {
            assert!(super::flags(benign).is_empty());
        }
        assert!(
            super::flags("Ignore ALL previous instructions").contains(&"policy_override_language")
        );
        assert!(
            super::flags("B\u{1ecf} qua t\u{1ea5}t c\u{1ea3} h\u{1b0}\u{1edb}ng d\u{1eab}n")
                .contains(&"policy_override_language")
        );
        assert!(super::flags("Quoted attack: `</system>`").contains(&"role_spoofing_marker"));
        assert!(
            super::flags("ordinary\u{200b}text").contains(&"invisible_or_directional_characters")
        );
    }
}
