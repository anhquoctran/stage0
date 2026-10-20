use crate::features::sandbox::guardrails::GuardrailsEngine;

pub fn safe_path(path: &str, guards: &GuardrailsEngine) -> Result<(), String> {
    if path.len() > 1024
        || path.contains('\\')
        || path.contains(':')
        || path.chars().any(char::is_control)
        || path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("Expected a literal relative repository file path".into());
    }
    let lower = path.to_ascii_lowercase();
    if [
        ".env",
        ".git/",
        "id_rsa",
        "id_ed25519",
        ".pem",
        ".key",
        ".pfx",
        ".pkcs12",
        "credentials",
        "secret",
        "token",
    ]
    .iter()
    .any(|part| lower.contains(part))
    {
        return Err("File excluded by mandatory review egress policy".into());
    }
    // Inventory scans and repeated snapshot checks are not tool invocations.
    // Consult the sensitive-path policy without consuming the sandbox read
    // rate limit; the review runtime enforces its own tool/context budgets.
    guards
        .evaluate_resolved_read_path(path)
        .map_err(|_| "File excluded by sensitive-path policy".to_string())?;
    Ok(())
}

/// Conservative line-based egress filter, not a guarantee that arbitrary secrets
/// can be recognized. Remote runs still require explicit source-sharing consent.
pub fn redact(text: &str) -> String {
    let mut in_private_key = false;
    text.lines()
        .map(|line| {
            let lower = line.to_ascii_lowercase();
            if lower.contains("-----begin") && lower.contains("private key") {
                in_private_key = true;
            }
            let sensitive = in_private_key
                || has_sensitive_assignment(&lower)
                || [
                    "ghp_",
                    "gho_",
                    "github_pat_",
                    "sk-",
                    "glpat-",
                    "xoxb-",
                    "akia",
                ]
                .iter()
                .any(|word| lower.contains(word));
            if lower.contains("-----end") && lower.contains("private key") {
                in_private_key = false;
            }
            if sensitive {
                "[REDACTED BY SOURCE EGRESS POLICY]".to_string()
            } else {
                crate::features::git::runner::redact_sensitive_text(line)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn has_sensitive_assignment(line: &str) -> bool {
    [
        "password",
        "passwd",
        "secret",
        "api_key",
        "api-key",
        "apikey",
        "authorization",
        "access_token",
        "refresh_token",
        "token",
        "credential",
    ]
    .iter()
    .any(|marker| {
        line.match_indices(marker).any(|(offset, _)| {
            let remainder = &line[offset + marker.len()..];
            let remainder = remainder.trim_start_matches(|character: char| {
                character.is_whitespace() || character == '"' || character == '\''
            });
            remainder.starts_with(':') || remainder.starts_with('=')
        })
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn sensitive_files_and_diff_lines_cannot_bypass_egress_policy() {
        let guards = crate::features::sandbox::guardrails::GuardrailsEngine::new();
        for path in [
            ".env",
            "a/../x",
            "/etc/passwd",
            "id_rsa",
            "a\\b",
            "a:secret",
        ] {
            assert!(super::safe_path(path, &guards).is_err());
        }
        let filtered = super::redact("+password = 'fixture'\n-----BEGIN PRIVATE KEY-----\nprivate material\n-----END PRIVATE KEY-----\nfn ordinary() {}");
        assert!(!filtered.contains("fixture") && !filtered.contains("private material"));
        assert!(filtered.contains("fn ordinary() {}"));

        let instruction =
            super::redact("Prefer checking authorization edge cases and token validation.");
        assert_eq!(
            instruction,
            "Prefer checking authorization edge cases and token validation."
        );
        assert!(super::redact("Authorization: Bearer fixture-secret")
            .contains("[REDACTED BY SOURCE EGRESS POLICY]"));
    }
}
