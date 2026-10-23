pub fn normalize(source: &str, mac: bool) -> Result<String, String> {
    let steps: Vec<_> = source.split_whitespace().collect();
    if source.len() > 128 || steps.is_empty() || steps.len() > 2 {
        return Err("Use one keystroke or a two-step chord (maximum 128 characters)".into());
    }
    steps
        .into_iter()
        .map(|step| stroke(step, mac))
        .collect::<Result<Vec<_>, _>>()
        .map(|items| items.join(" "))
}

fn stroke(source: &str, mac: bool) -> Result<String, String> {
    let mut parts: Vec<_> = source.split('+').map(str::trim).collect();
    let raw = parts.pop().unwrap_or_default();
    let lower = raw.to_ascii_lowercase();
    let names = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Enter",
        "Escape",
        "Tab",
        "Space",
        "Backspace",
        "Delete",
        "Insert",
        "Backquote",
        "Equal",
        "Minus",
        "BracketLeft",
        "BracketRight",
        "Backslash",
        "Semicolon",
        "Quote",
    ];
    let key = names
        .iter()
        .find(|name| name.to_ascii_lowercase() == lower)
        .map(|name| name.to_string())
        .unwrap_or_else(|| match raw {
            "`" | "~" => "Backquote".into(),
            "=" => "Equal".into(),
            "-" | "_" => "Minus".into(),
            "[" => "BracketLeft".into(),
            "]" => "BracketRight".into(),
            "\\" => "Backslash".into(),
            ";" => "Semicolon".into(),
            "'" => "Quote".into(),
            _ if lower == "slash" => "/".into(),
            _ if lower == "comma" => ",".into(),
            _ if lower == "period" => ".".into(),
            _ => raw.to_ascii_uppercase(),
        });
    let valid = names.contains(&key.as_str())
        || (key.len() == 1
            && (key.as_bytes()[0].is_ascii_alphanumeric()
                || [",", ".", "/"].contains(&key.as_str())))
        || key
            .strip_prefix('F')
            .and_then(|number| number.parse::<u8>().ok())
            .is_some_and(|number| (1..=24).contains(&number) && key == format!("F{number}"));
    if !valid {
        return Err(format!("Unsupported key: {raw}"));
    }
    let mut mods = Vec::new();
    let mut primary = false;
    let mut explicit = false;
    for part in parts {
        let modifier = match part.to_ascii_lowercase().as_str() {
            "cmdorctrl" | "commandorcontrol" | "mod" => {
                primary = true;
                if mac {
                    "Cmd"
                } else {
                    "Ctrl"
                }
            }
            "ctrl" | "control" => {
                explicit = true;
                "Ctrl"
            }
            "cmd" | "command" | "meta" => {
                explicit = true;
                "Cmd"
            }
            "alt" | "option" => "Alt",
            "shift" => "Shift",
            _ => return Err(format!("Unsupported modifier: {part}")),
        };
        if mods.contains(&modifier) {
            return Err("Duplicate modifier".into());
        }
        mods.push(modifier);
    }
    if primary && explicit {
        return Err("CmdOrCtrl cannot be combined with Ctrl or Cmd".into());
    }
    let mut result: Vec<_> = ["Ctrl", "Cmd", "Alt", "Shift"]
        .into_iter()
        .filter(|part| mods.contains(part))
        .map(str::to_owned)
        .collect();
    result.push(key);
    Ok(result.join("+"))
}
