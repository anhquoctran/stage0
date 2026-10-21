use serde_json::{Map, Value};

pub(super) fn object_section<'a>(
    value: &'a Value,
    name: &str,
) -> Result<&'a Map<String, Value>, String> {
    value
        .get(name)
        .and_then(Value::as_object)
        .ok_or_else(|| format!("{name} must be an object"))
}

pub(super) fn validate_optional_bool(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
) -> Result<(), String> {
    if object.get(key).is_some_and(|value| !value.is_boolean()) {
        return Err(format!("{path}.{key} must be a boolean"));
    }
    Ok(())
}

pub(super) fn validate_optional_string(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    max: usize,
    allow_empty: bool,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let text = value
            .as_str()
            .ok_or_else(|| format!("{path}.{key} must be a string"))?;
        if text.len() > max || (!allow_empty && text.trim().is_empty()) {
            return Err(format!(
                "{path}.{key} is empty or exceeds the {max}-character limit"
            ));
        }
    }
    Ok(())
}

pub(super) fn validate_optional_number(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    min: f64,
    max: f64,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let number = value
            .as_f64()
            .ok_or_else(|| format!("{path}.{key} must be a number"))?;
        if !number.is_finite() || number < min || number > max {
            return Err(format!("{path}.{key} must be between {min} and {max}"));
        }
    }
    Ok(())
}

pub(super) fn validate_optional_integer(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    min: u64,
    max: u64,
) -> Result<(), String> {
    if let Some(value) = object.get(key) {
        let number = value
            .as_u64()
            .ok_or_else(|| format!("{path}.{key} must be a positive integer"))?;
        if number < min || number > max {
            return Err(format!("{path}.{key} must be between {min} and {max}"));
        }
    }
    Ok(())
}

pub(super) fn validate_optional_enum(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    values: &[&str],
) -> Result<(), String> {
    if object.contains_key(key) {
        validate_enum_string(object, key, path, values)?;
    }
    Ok(())
}

pub(super) fn validate_enum_string(
    object: &Map<String, Value>,
    key: &str,
    path: &str,
    values: &[&str],
) -> Result<(), String> {
    let value = object
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{path}.{key} must be a string"))?;
    if !values.contains(&value) {
        return Err(format!("{path}.{key} has an unsupported value"));
    }
    Ok(())
}

pub(super) fn validate_string_array(
    value: &Value,
    path: &str,
    max_items: usize,
    max_item_len: usize,
) -> Result<(), String> {
    let values = value
        .as_array()
        .ok_or_else(|| format!("{path} must be an array of strings"))?;
    if values.len() > max_items {
        return Err(format!("{path} has too many entries"));
    }
    for item in values {
        let text = item
            .as_str()
            .ok_or_else(|| format!("{path} must contain only strings"))?;
        if text.len() > max_item_len {
            return Err(format!("An entry in {path} exceeds its length limit"));
        }
    }
    Ok(())
}
