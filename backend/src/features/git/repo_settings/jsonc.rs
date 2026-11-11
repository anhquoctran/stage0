use super::schema::{validate, MAX_BYTES};
use crate::features::preferences::{merge_settings_object, strict_jsonc_options};
use jsonc_parser::{ast, cst::CstRootNode, parse_to_ast};
use serde_json::Value;
use std::collections::HashSet;

pub fn parse(content: &str) -> Result<Value, String> {
    if content.len() > MAX_BYTES {
        return Err("Repository settings exceed 1 MiB".into());
    }
    // Bound nesting before invoking a recursive parser, including hostile input.
    let mut depth = 0usize;
    let mut string = false;
    let mut escape = false;
    let mut line_comment = false;
    let mut block_comment = false;
    let bytes = content.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        let next = bytes.get(i + 1).copied();
        if line_comment {
            if b == b'\n' {
                line_comment = false;
            }
        } else if block_comment {
            if b == b'*' && next == Some(b'/') {
                block_comment = false;
                i += 1;
            }
        } else if string {
            if escape {
                escape = false;
            } else if b == b'\\' {
                escape = true;
            } else if b == b'"' {
                string = false;
            }
        } else if b == b'/' && next == Some(b'/') {
            line_comment = true;
            i += 1;
        } else if b == b'/' && next == Some(b'*') {
            block_comment = true;
            i += 1;
        } else if b == b'"' {
            string = true;
        } else if b == b'{' || b == b'[' {
            depth += 1;
            if depth > 16 {
                return Err("Repository settings nesting exceeds 16".into());
            }
        } else if b == b'}' || b == b']' {
            depth = depth.saturating_sub(1);
        }
        i += 1;
    }
    let parsed =
        parse_to_ast(content, &Default::default(), &strict_jsonc_options()).map_err(|e| {
            format!(
                "repos.jsonc line {}, column {}: {}",
                e.line_display(),
                e.column_display(),
                e.kind()
            )
        })?;
    let node = parsed.value.ok_or("repos.jsonc is empty")?;
    unique_keys(&node)?;
    let value: Value = jsonc_parser::parse_to_serde_value(content, &strict_jsonc_options())
        .map_err(|e| e.to_string())?;
    validate(&value)?;
    Ok(value)
}

fn unique_keys(node: &ast::Value<'_>) -> Result<(), String> {
    match node {
        ast::Value::Object(object) => {
            let mut seen = HashSet::new();
            for prop in &object.properties {
                let key = prop.name.clone().into_string();
                if !seen.insert(key.clone()) {
                    return Err(format!("Duplicate JSONC key: {key}"));
                }
                unique_keys(&prop.value)?;
            }
        }
        ast::Value::Array(array) => {
            for node in &array.elements {
                unique_keys(node)?;
            }
        }
        _ => (),
    }
    Ok(())
}

pub fn patch(content: &str, updates: &Value) -> Result<String, String> {
    // Bound IPC values before recursively constructing a CST candidate.
    let mut pending = vec![(updates, 0usize)];
    let mut bytes = 0usize;
    let mut nodes = 0usize;
    while let Some((value, depth)) = pending.pop() {
        nodes += 1;
        if depth > 16 || nodes > 16_384 || bytes > MAX_BYTES {
            return Err("Repository patch exceeds resource limits".into());
        }
        match value {
            Value::Object(items) => {
                if items.len() > 16_384 {
                    return Err("Repository patch has too many entries".into());
                }
                for (key, child) in items {
                    bytes += key.len();
                    pending.push((child, depth + 1));
                }
            }
            Value::Array(items) => pending.extend(items.iter().map(|child| (child, depth + 1))),
            Value::String(text) => bytes += text.len(),
            _ => bytes += 8,
        }
    }
    if bytes > MAX_BYTES {
        return Err("Repository patch exceeds 1 MiB".into());
    }
    super::schema::keys(updates, super::schema::FIELDS, "patch")?;
    if updates.get("schemaVersion").is_some() {
        return Err("schemaVersion is not editable".into());
    }
    let root = CstRootNode::parse(content, &strict_jsonc_options()).map_err(|e| e.to_string())?;
    let object = root.object_value().ok_or("Settings must be an object")?;
    merge_settings_object(&object, updates.as_object().unwrap())?;
    let candidate = root.to_string();
    parse(&candidate)?;
    Ok(candidate)
}
