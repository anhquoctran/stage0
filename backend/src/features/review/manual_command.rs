//! Exact host-managed root commands; never infer recipients from display names.
use std::collections::HashSet;

fn decode_id(value: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(value.len());
    let mut input = value.bytes();
    while let Some(byte) = input.next() {
        bytes.push(if byte == b'%' {
            let high = (input.next()? as char).to_digit(16)?;
            let low = (input.next()? as char).to_digit(16)?;
            (high * 16 + low) as u8
        } else if byte.is_ascii() && !byte.is_ascii_whitespace() && !b"()".contains(&byte) {
            byte
        } else {
            return None;
        });
    }
    let id = String::from_utf8(bytes).ok()?;
    (!id.is_empty() && !id.chars().any(char::is_control)).then_some(id)
}

pub(super) fn targets(body: &str) -> Option<Vec<String>> {
    let mut rest = body.trim();
    if rest.contains(['\r', '\n']) {
        return None;
    }
    let mut targets = Vec::new();
    let mut seen = HashSet::new();
    loop {
        let label = rest.strip_prefix("[@")?;
        let mut escaped = false;
        let mut end = None;
        for (index, ch) in label.char_indices() {
            if ch.is_control() {
                return None;
            }
            if escaped {
                escaped = false;
                continue;
            }
            match ch {
                '\\' => escaped = true,
                '[' => return None,
                ']' => {
                    if index == 0 {
                        return None;
                    }
                    end = Some(index);
                    break;
                }
                _ => {}
            }
        }
        let href = label[end? + 1..].strip_prefix("(#mr-mention/reviewer/")?;
        let (encoded_id, tail) = href.split_once(')')?;
        let id = decode_id(encoded_id)?;
        if seen.insert(id.clone()) {
            targets.push(id);
        }
        rest = tail.trim_start_matches([' ', '\t']);
        if rest.len() == tail.len() {
            return None;
        }
        if rest.eq_ignore_ascii_case("review") {
            return Some(targets);
        }
    }
}
