use jsonc_parser::cst::{CstInputValue, CstObject};
use serde_json::{Map, Value};

pub(super) fn merge_object(target: &CstObject, patch: &Map<String, Value>) -> Result<(), String> {
    for (key, value) in patch {
        if is_delete_marker(value) {
            if let Some(property) = target.get(key) {
                property.remove();
            }
            continue;
        }
        match (target.get(key), value.as_object()) {
            (Some(prop), Some(nested)) => match prop.value().and_then(|node| node.as_object()) {
                Some(child) => merge_object(&child, nested)?,
                None => prop.set_value(to_cst_without_delete_markers(value)?),
            },
            (Some(prop), None) => prop.set_value(to_cst_without_delete_markers(value)?),
            (None, _) => {
                target.append(key, to_cst_without_delete_markers(value)?);
            }
        }
    }
    Ok(())
}

fn is_delete_marker(value: &Value) -> bool {
    value.as_object().is_some_and(|object| {
        object.len() == 1 && object.get("$stage0Delete") == Some(&Value::Bool(true))
    })
}

/// Delete markers are patch instructions, never persisted data. When an
/// object is added or replaces a non-object value there is no existing CST
/// child to recurse into, so strip nested instructions before conversion.
fn to_cst_without_delete_markers(value: &Value) -> Result<CstInputValue, String> {
    match value {
        Value::Object(values) => Ok(CstInputValue::Object(
            values
                .iter()
                .filter(|(_, value)| !is_delete_marker(value))
                .map(|(key, value)| Ok((key.clone(), to_cst_without_delete_markers(value)?)))
                .collect::<Result<_, String>>()?,
        )),
        Value::Array(values) => Ok(CstInputValue::Array(
            values
                .iter()
                .map(to_cst_without_delete_markers)
                .collect::<Result<_, _>>()?,
        )),
        _ => to_cst(value),
    }
}

fn to_cst(value: &Value) -> Result<CstInputValue, String> {
    Ok(match value {
        Value::Null => CstInputValue::Null,
        Value::Bool(value) => CstInputValue::Bool(*value),
        Value::Number(value) => CstInputValue::Number(value.to_string()),
        Value::String(value) => CstInputValue::String(value.clone()),
        Value::Array(values) => {
            CstInputValue::Array(values.iter().map(to_cst).collect::<Result<_, _>>()?)
        }
        Value::Object(values) => CstInputValue::Object(
            values
                .iter()
                .map(|(key, value)| Ok((key.clone(), to_cst(value)?)))
                .collect::<Result<_, String>>()?,
        ),
    })
}
