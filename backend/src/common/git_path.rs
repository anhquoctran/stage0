//! Git's C-style path quoting with core.quotePath=false (UTF-8 stays literal).
pub fn quote(path: &str) -> String {
    if !path
        .bytes()
        .any(|byte| byte < 0x20 || matches!(byte, 0x7f | b'"' | b'\\'))
    {
        return path.to_owned();
    }
    let mut output = Vec::with_capacity(path.len() + 2);
    output.push(b'"');
    for byte in path.bytes() {
        let escaped = match byte {
            7 => Some(b'a'),
            8 => Some(b'b'),
            9 => Some(b't'),
            10 => Some(b'n'),
            11 => Some(b'v'),
            12 => Some(b'f'),
            13 => Some(b'r'),
            b'"' => Some(b'"'),
            b'\\' => Some(b'\\'),
            _ => None,
        };
        if let Some(escaped) = escaped {
            output.extend_from_slice(&[b'\\', escaped]);
        } else if byte < 0x20 || byte == 0x7f {
            output.extend_from_slice(format!("\\{byte:03o}").as_bytes());
        } else {
            output.push(byte);
        }
    }
    output.push(b'"');
    String::from_utf8(output).expect("escaped UTF-8 path")
}

pub fn unquote(path: &str) -> Result<String, String> {
    if !path.starts_with('"') {
        return Ok(path.to_owned());
    }
    let inner = path
        .strip_prefix('"')
        .and_then(|path| path.strip_suffix('"'))
        .ok_or("Invalid quoted Git path")?;
    let mut output = Vec::with_capacity(inner.len());
    let mut bytes = inner.bytes();
    while let Some(byte) = bytes.next() {
        if byte != b'\\' {
            output.push(byte);
            continue;
        }
        let escaped = bytes.next().ok_or("Incomplete Git path escape")?;
        output.push(match escaped {
            b'a' => 7,
            b'b' => 8,
            b't' => 9,
            b'n' => 10,
            b'v' => 11,
            b'f' => 12,
            b'r' => 13,
            b'"' => b'"',
            b'\\' => b'\\',
            b'0'..=b'3' => {
                let second = bytes
                    .next()
                    .filter(|b| (b'0'..=b'7').contains(b))
                    .ok_or("Invalid Git octal escape")?;
                let third = bytes
                    .next()
                    .filter(|b| (b'0'..=b'7').contains(b))
                    .ok_or("Invalid Git octal escape")?;
                (escaped - b'0') * 64 + (second - b'0') * 8 + third - b'0'
            }
            _ => return Err("Unknown Git path escape".into()),
        });
    }
    String::from_utf8(output).map_err(|_| "Git filename is not UTF-8".into())
}
