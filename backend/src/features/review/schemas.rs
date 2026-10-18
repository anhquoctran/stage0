use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    let string = json!({"type":"string","maxLength":1024});
    let side = json!({"type":"string","enum":["base","head"]});
    let index = json!({"type":"integer","minimum":0,"maximum":100000});
    let line = json!({"type":"integer","minimum":1,"maximum":10000000});
    let definitions = [
        ("list_changed_files", "List changed paths in the fixed review snapshot. Paginate with offset; excluded paths are reported separately and must never be read.", json!({"offset":index})),
        ("get_diff", "Get the snapshot identity and changed-file inventory. Use get_file_diff for source hunks; this tool does not return an unfiltered repository-wide diff.", json!({})),
        ("get_file_diff", "Read a bounded, redacted three-dot diff for exactly one changed file. Paginate by offset (diff lines); inspect every page. All reads use immutable Git objects, never the working tree.", json!({"filePath":string,"offset":index})),
        ("read_file_range", "Read up to 200 numbered lines of a regular Git blob on the base (merge-base) or head side. Sensitive paths, symlinks, binary/large files and secrets are blocked or redacted. Never assume the user's checkout matches this snapshot.", json!({"filePath":string,"side":side,"startLine":line,"endLine":line})),
        ("search_code", "Find a literal string (3–120 characters) in the head snapshot. Returns bounded, redacted matches with paths and line numbers; not regex or a shell command.", json!({"query":{"type":"string","minLength":3,"maxLength":120}})),
        ("list_directory", "List regular file paths under a directory prefix in the head snapshot. Use an empty prefix for root and paginate with offset. No host filesystem access.", json!({"prefix":string,"offset":index})),
        ("submit_review", "Finish the review with a short summary and evidence-backed findings. Each finding must quote exact non-redacted source in its stated range, target a changed path, and use base/head coordinates. No finding means no issue identified, NOT approval. Do not submit if tools failed or context is incomplete without describing the limitation.", json!({
            "summary":{"type":"string","minLength":1,"maxLength":4000},
            "findings":{"type":"array","maxItems":50,"items":object(json!({
                "filePath":string,"side":side,"startLine":line,"endLine":line,
                "severity":{"type":"string","enum":["critical","high","medium","low"]},
                "title":{"type":"string","minLength":1,"maxLength":160},
                "body":{"type":"string","minLength":1,"maxLength":4000},
                "evidence":{"type":"string","minLength":1,"maxLength":1000}
            }))}
        })),
    ];
    definitions.into_iter().map(|(name,description,properties)| json!({"name":name,"description":description,"parameters":object(properties)})).collect()
}

fn object(properties: Value) -> Value {
    let required = properties
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    json!({"type":"object","properties":properties,"required":required,"additionalProperties":false})
}

pub fn validate(schema: &Value, value: &Value) -> Result<(), String> {
    let valid = match schema["type"].as_str() {
        Some("object") => {
            let obj = value.as_object().ok_or("Expected object arguments")?;
            let props = schema["properties"]
                .as_object()
                .ok_or("Invalid tool schema")?;
            if obj.len() != props.len() || obj.keys().any(|key| !props.contains_key(key)) {
                return Err("Missing or unknown tool arguments".into());
            }
            for (name, property) in props {
                validate(property, obj.get(name).ok_or("Missing argument")?)?;
            }
            true
        }
        Some("string") => value.as_str().is_some_and(|s| {
            let length = s.chars().count();
            length >= schema["minLength"].as_u64().unwrap_or(0) as usize
                && length <= schema["maxLength"].as_u64().unwrap_or(1024) as usize
        }),
        Some("integer") => value.as_u64().is_some_and(|v| {
            v >= schema["minimum"].as_u64().unwrap_or(0)
                && v <= schema["maximum"].as_u64().unwrap_or(u64::MAX)
        }),
        Some("array") => {
            let array = value.as_array().ok_or("Expected array")?;
            if array.len() > schema["maxItems"].as_u64().unwrap_or(100) as usize {
                return Err("Too many items".into());
            }
            for item in array {
                validate(&schema["items"], item)?;
            }
            true
        }
        _ => false,
    };
    if !valid
        || schema["enum"]
            .as_array()
            .is_some_and(|items| !items.contains(value))
    {
        Err("Invalid argument type, value or limit".into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    #[test]
    fn schemas_are_closed_and_reject_injection_and_unbounded_arguments() {
        let tools = super::tools();
        let read = &tools
            .iter()
            .find(|t| t["name"] == "read_file_range")
            .unwrap()["parameters"];
        assert!(super::validate(
            read,
            &json!({"filePath":"a.rs","side":"head","startLine":1,"endLine":5})
        )
        .is_ok());
        for args in [
            json!({}),
            json!({"filePath":"a","side":"host","startLine":1,"endLine":2}),
            json!({"filePath":"a","side":"head","startLine":-1,"endLine":2}),
            json!({"filePath":"a","side":"head","startLine":1,"endLine":2,"command":"rm"}),
        ] {
            assert!(super::validate(read, &args).is_err());
        }
        assert!(!tools.iter().any(|t| t["name"] == "execute_terminal_cmd"));
        assert!(super::validate(&json!({"type":"string","maxLength":2}), &json!("漢字")).is_ok());
    }
}
