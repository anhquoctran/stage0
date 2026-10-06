use std::process::Command;
use std::sync::RwLock;
use std::time::Duration;

const DEFAULT_STDOUT_LIMIT: usize = 16 * 1024 * 1024;
const DEFAULT_STDERR_LIMIT: usize = 1024 * 1024;
const DEFAULT_GIT_TIMEOUT: Duration = Duration::from_secs(120);

static ACTIVE_GIT_PATH: RwLock<Option<String>> = RwLock::new(None);

pub fn set_active_git_path(path: Option<String>) {
    if let Ok(mut lock) = ACTIVE_GIT_PATH.write() {
        *lock = path;
    }
}

pub fn get_active_git_path() -> String {
    if let Ok(lock) = ACTIVE_GIT_PATH.read() {
        if let Some(ref p) = *lock {
            let trimmed = p.trim();
            if !trimmed.is_empty() && trimmed != "system" {
                return trimmed.to_string();
            }
        }
    }
    "git".to_string()
}

pub struct CmdResult {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub code: Option<i32>,
    /// True when Git produced more output than the configured cap and was stopped.
    pub output_truncated: bool,
}

pub fn run_git(repo_path: &str, args: &[&str]) -> Result<CmdResult, String> {
    let result = run_git_with_limits(
        repo_path,
        args,
        DEFAULT_STDOUT_LIMIT,
        DEFAULT_STDERR_LIMIT,
        DEFAULT_GIT_TIMEOUT,
    )?;
    if result.output_truncated {
        return Err("Git command output exceeded the configured safety limit".to_string());
    }
    Ok(result)
}

/// Runs Git while draining both pipes concurrently, with bounded memory and a
/// wall-clock limit. On output overflow the captured prefix is returned with
/// `output_truncated` set; callers must not treat it as a complete result.
pub fn run_git_with_limits(
    repo_path: &str,
    args: &[&str],
    stdout_limit: usize,
    stderr_limit: usize,
    timeout: Duration,
) -> Result<CmdResult, String> {
    let git_bin = get_active_git_path();
    let mut cmd = Command::new(&git_bin);
    cmd.current_dir(repo_path);
    cmd.args(args);
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_PAGER", "cat");
    // Git's `ext::` protocol and unknown remote-helper schemes can spawn
    // arbitrary local programs when operating on a repository remote.
    cmd.env("GIT_ALLOW_PROTOCOL", "git:http:https:ssh");
    let output =
        crate::common::process::run_bounded_command(&mut cmd, stdout_limit, stderr_limit, timeout)
            .map_err(|e| format!("Git command failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(CmdResult {
        stdout,
        stderr,
        success: output.status.success() && !output.output_truncated,
        code: output.status.code(),
        output_truncated: output.output_truncated,
    })
}

pub fn run_git_strict(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let res = run_git(repo_path, args)?;
    if res.output_truncated {
        return Err("Git command output exceeded the configured safety limit".to_string());
    }
    if !res.success {
        let err_msg = if !res.stderr.trim().is_empty() {
            redact_sensitive_text(res.stderr.trim())
        } else {
            redact_sensitive_text(res.stdout.trim())
        };
        return Err(format!("Git command failed: {}", err_msg));
    }
    Ok(res.stdout)
}

pub(crate) fn redact_sensitive_text(text: &str) -> String {
    let mut redacted = String::with_capacity(text.len());
    for line in text.split_inclusive('\n') {
        let (body, newline) = line
            .strip_suffix('\n')
            .map_or((line, ""), |body| (body, "\n"));
        redacted.push_str(&redact_sensitive_line(body));
        redacted.push_str(newline);
    }
    redacted
}

fn redact_sensitive_line(line: &str) -> String {
    let lower = line.to_ascii_lowercase();
    for header in ["authorization:", "proxy-authorization:"] {
        if let Some(offset) = lower.find(header) {
            let value_start = offset + header.len();
            let mut output = line[..value_start].to_string();
            output.push_str(" [REDACTED]");
            return output;
        }
    }

    let mut redacted = String::with_capacity(line.len());
    let mut redact_next_token = false;
    for token in line.split_inclusive(char::is_whitespace) {
        let trailing_ws_len = token
            .chars()
            .rev()
            .take_while(|c| c.is_whitespace())
            .map(char::len_utf8)
            .sum::<usize>();
        let (body, whitespace) = token.split_at(token.len().saturating_sub(trailing_ws_len));
        let mut safe = if redact_next_token {
            redact_next_token = false;
            "[REDACTED]".to_string()
        } else {
            body.to_string()
        };

        if let Some(scheme_end) = safe.find("://") {
            let authority_start = scheme_end + 3;
            let authority_end = safe[authority_start..]
                .find(|c| matches!(c, '/' | '?' | '#' | ',' | ')' | ']' | '\'' | '"'))
                .map(|offset| authority_start + offset)
                .unwrap_or(safe.len());
            if let Some(at) = safe[authority_start..authority_end]
                .rfind('@')
                .map(|offset| authority_start + offset)
            {
                safe.replace_range(authority_start..at, "[REDACTED]");
            }
        }

        let lower = safe.to_ascii_lowercase();
        for key in [
            "access_token=",
            "access-token=",
            "private_token=",
            "oauth_token=",
            "token=",
            "password=",
            "api_key=",
            "api-key=",
            "client_secret=",
            "signature=",
            "sig=",
            "x-amz-signature=",
            "x-amz-security-token=",
        ] {
            if let Some(offset) = lower.find(key) {
                let value_start = offset + key.len();
                let value_end = safe[value_start..]
                    .find(|c| matches!(c, '&' | '#' | ',' | ')' | ']' | '\'' | '"'))
                    .map(|end| value_start + end)
                    .unwrap_or(safe.len());
                safe.replace_range(value_start..value_end, "[REDACTED]");
                break;
            }
        }
        if matches!(
            safe.to_ascii_lowercase()
                .trim_end_matches(':')
                .trim_end_matches(','),
            "bearer" | "basic"
        ) {
            redact_next_token = true;
        }
        redacted.push_str(&safe);
        redacted.push_str(whitespace);
    }
    redacted
}

pub fn resolve_ref(repo_path: &str, r: &str) -> Result<(String, String), String> {
    let trimmed = r.trim();
    if trimmed.is_empty() {
        return Err("Cannot resolve empty reference".to_string());
    }

    if trimmed.starts_with('-') {
        return Err("Invalid Git reference: option-like values are not accepted".to_string());
    }

    if trimmed.chars().any(|c| c.is_control() || c == ' ') {
        return Err(
            "Invalid Git reference: whitespace and control characters are not accepted".to_string(),
        );
    }

    let mut candidates = vec![trimmed.to_string()];
    if !trimmed.starts_with("origin/") && !trimmed.starts_with("refs/") {
        candidates.push(format!("origin/{}", trimmed));
        candidates.push(format!("remotes/origin/{}", trimmed));
    }
    if let Some(stripped) = trimmed.strip_prefix("origin/") {
        candidates.push(stripped.to_string());
    }

    let mut last_error = None;
    for candidate in candidates {
        // Require exactly one commit-ish and return its object ID. Passing a
        // caller's revision expression into a later `A...B` range can turn it
        // into multiple revisions or change the meaning of the comparison.
        let commit_expr = format!("{}^{{commit}}", candidate);
        match run_git_strict(
            repo_path,
            &["rev-parse", "--verify", "--end-of-options", &commit_expr],
        ) {
            Ok(output) => {
                let oid = output.trim();
                if (oid.len() == 40 || oid.len() == 64)
                    && oid.chars().all(|character| character.is_ascii_hexdigit())
                {
                    return Ok((oid.to_string(), oid.to_string()));
                }
                last_error =
                    Some("Git did not resolve the selected reference to one commit".to_string());
            }
            Err(error) => last_error = Some(error),
        }
    }

    // Never silently substitute another branch or HEAD: comparisons must use
    // the refs the user selected, otherwise a deleted ref can show a false diff.
    Err(last_error.unwrap_or_else(|| "Unable to resolve the selected Git reference".to_string()))
}

#[cfg(test)]
mod tests {
    use super::redact_sensitive_text;

    #[test]
    fn redacts_credentials_from_common_error_formats() {
        let text = concat!(
            "remote: https://user:pass@example.test/repo\n",
            "access_token=topsecret&scope=repo\n",
            "Authorization: Bearer headersecret\n",
            "failed Bearer tokensecret\n",
        );
        let redacted = redact_sensitive_text(text);
        for secret in ["user:pass", "topsecret", "headersecret", "tokensecret"] {
            assert!(!redacted.contains(secret), "secret leaked in: {redacted}");
        }
        assert!(redacted.contains("scope=repo"));
        assert!(redacted.contains("Authorization: [REDACTED]"));
    }
}
