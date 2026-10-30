pub(super) fn is_supported_remote_url(value: &str) -> bool {
    validate_remote_url(value).is_ok()
}

pub fn validate_remote_url(value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty()
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
        || value.contains('?')
        || value.contains('#')
    {
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlInvalid",
        ));
    }

    if value.starts_with("git@") {
        let Some((host, path)) = value[4..].rsplit_once(':') else {
            return Err(crate::common::messages::code(
                "backend.git.remoteUrlInvalid",
            ));
        };
        if path.is_empty() || host.contains('@') {
            return Err(crate::common::messages::code(
                "backend.git.remoteUrlInvalid",
            ));
        }
        validate_ssh_host(host, false)?;
        return Ok(());
    }

    let Some((scheme, remainder)) = value.split_once("://") else {
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlInvalid",
        ));
    };
    if !matches!(
        scheme.to_ascii_lowercase().as_str(),
        "https" | "http" | "ssh"
    ) {
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlInvalid",
        ));
    }

    let authority = remainder.split('/').next().unwrap_or_default();
    let host = if scheme.eq_ignore_ascii_case("ssh") {
        if let Some((user, host)) = authority.split_once('@') {
            if !is_safe_ssh_user(user) || host.is_empty() || host.contains('@') {
                return Err(crate::common::messages::code(
                    "backend.git.remoteUrlInvalid",
                ));
            }
            host
        } else {
            authority
        }
    } else {
        if authority.contains('@') {
            return Err(crate::common::messages::code(
                "backend.git.remoteUrlInvalid",
            ));
        }
        authority
    };
    if host.is_empty() {
        return Err(crate::common::messages::code(
            "backend.git.remoteUrlInvalid",
        ));
    }
    if scheme.eq_ignore_ascii_case("ssh") {
        validate_ssh_host(host, true)?;
        if remainder
            .split_once('/')
            .map_or(true, |(_, path)| path.is_empty())
        {
            return Err(crate::common::messages::code(
                "backend.git.remoteUrlInvalid",
            ));
        }
    }

    Ok(())
}

fn is_safe_ssh_user(user: &str) -> bool {
    !user.is_empty()
        && user
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_alphanumeric() || matches!(first, '_' | '.'))
        && user.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
}

fn validate_ssh_host(host: &str, allow_port: bool) -> Result<(), String> {
    let invalid = || "SSH remote URL must use a valid host, not an option-like value".to_string();
    let is_ipv6 = host.starts_with('[');
    let (host_name, port) = if let Some(ipv6_and_suffix) = host.strip_prefix('[') {
        let (ipv6, suffix) = ipv6_and_suffix.split_once(']').ok_or_else(invalid)?;
        ipv6.parse::<std::net::Ipv6Addr>().map_err(|_| invalid())?;
        let port = if suffix.is_empty() {
            None
        } else if allow_port {
            Some(suffix.strip_prefix(':').ok_or_else(invalid)?)
        } else {
            return Err(invalid());
        };
        (ipv6, port)
    } else if let Some((name, port)) = host.split_once(':') {
        if !allow_port || name.contains(':') {
            return Err(invalid());
        }
        (name, Some(port))
    } else {
        (host, None)
    };

    if host_name.is_empty()
        || host_name.starts_with('-')
        || (!is_ipv6
            && !host_name.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
            }))
        || port.is_some_and(|port| port.is_empty() || !port.chars().all(|c| c.is_ascii_digit()))
    {
        return Err(invalid());
    }
    Ok(())
}
