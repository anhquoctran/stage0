use super::TextEncoding;

pub(super) fn bom(bytes: &[u8]) -> Option<(TextEncoding, usize)> {
    if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
        Some((TextEncoding::Utf8Bom, 3))
    } else if bytes.starts_with(&[0xff, 0xfe]) {
        Some((TextEncoding::Utf16Le, 2))
    } else if bytes.starts_with(&[0xfe, 0xff]) {
        Some((TextEncoding::Utf16Be, 2))
    } else {
        None
    }
}

/// Strict conversion: malformed sequences are errors, never replacement characters.
pub(super) fn decode(bytes: &[u8], encoding: TextEncoding) -> Result<String, String> {
    use TextEncoding::*;
    let bytes = if let Some((marked, length)) = bom(bytes) {
        if marked != encoding && !(marked == Utf8Bom && encoding == Utf8) {
            return Err("Selected encoding conflicts with the file BOM".into());
        }
        &bytes[length..]
    } else {
        bytes
    };
    decode_payload(bytes, encoding)
}

pub(super) fn decode_payload(bytes: &[u8], encoding: TextEncoding) -> Result<String, String> {
    use TextEncoding::*;
    if matches!(encoding, Utf8 | Utf8Bom) {
        return std::str::from_utf8(bytes)
            .map(str::to_owned)
            .map_err(|_| "Invalid UTF-8 text".into());
    }
    if matches!(encoding, Utf16Le | Utf16Be) {
        if bytes.len() % 2 != 0 {
            return Err("Incomplete UTF-16 code unit".into());
        }
        let units = bytes.chunks_exact(2).map(|pair| {
            if encoding == Utf16Le {
                u16::from_le_bytes([pair[0], pair[1]])
            } else {
                u16::from_be_bytes([pair[0], pair[1]])
            }
        });
        return char::decode_utf16(units)
            .collect::<Result<String, _>>()
            .map_err(|_| "Invalid UTF-16 surrogate pair".into());
    }
    if encoding == Iso8859_1 {
        return Ok(bytes.iter().map(|byte| char::from(*byte)).collect());
    }
    let table = match encoding {
        Ibm437 => Some(&oem_cp::code_table::DECODING_TABLE_CP437),
        Ibm850 => Some(&oem_cp::code_table::DECODING_TABLE_CP850),
        Ibm852 => Some(&oem_cp::code_table::DECODING_TABLE_CP852),
        Ibm865 => Some(&oem_cp::code_table::DECODING_TABLE_CP865),
        _ => None,
    };
    if let Some(table) = table {
        return Ok(bytes
            .iter()
            .map(|byte| {
                if *byte < 128 {
                    char::from(*byte)
                } else {
                    table[usize::from(*byte - 128)]
                }
            })
            .collect());
    }
    if matches!(encoding, Gbk | Gb2312) {
        validate_chinese(bytes, encoding)?;
    }
    let codec = encoding.codec().ok_or("Unsupported text encoding")?;
    if matches!(encoding, Iso8859_9 | Iso8859_11) {
        // WHATWG aliases these ISO encodings to Windows variants. Preserve C1
        // controls for the actual ISO encodings instead of decoding punctuation.
        let mut output = String::with_capacity(bytes.len());
        for byte in bytes {
            if *byte < 0xa0 {
                output.push(char::from(*byte));
            } else {
                output.push_str(
                    &codec
                        .decode_without_bom_handling_and_without_replacement(&[*byte])
                        .ok_or("Undefined byte in selected encoding")?,
                );
            }
        }
        return Ok(output);
    }
    codec
        .decode_without_bom_handling_and_without_replacement(bytes)
        .map(|text| chinese_characters(text.into_owned(), encoding))
        .ok_or_else(|| "Invalid byte sequence for selected encoding".into())
}

pub(super) fn chinese_characters(text: String, encoding: TextEncoding) -> String {
    // GB2312's two historically distinct punctuation mappings differ from
    // GBK/GB18030; a declared GB2312 file must retain its actual characters.
    if encoding == TextEncoding::Gb2312 {
        text.replace('\u{b7}', "\u{30fb}")
            .replace('\u{2014}', "\u{2015}")
    } else {
        text
    }
}

pub(super) fn validate_chinese(bytes: &[u8], encoding: TextEncoding) -> Result<(), String> {
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte < 0x80 || (byte == 0x80 && encoding == TextEncoding::Gbk) {
            index += 1;
            continue;
        }
        let trail = *bytes
            .get(index + 1)
            .ok_or("Incomplete Chinese byte sequence")?;
        let valid = if encoding == TextEncoding::Gb2312 {
            (0xa1..=0xf7).contains(&byte) && (0xa1..=0xfe).contains(&trail)
        } else {
            (0x81..=0xfe).contains(&byte) && (0x40..=0xfe).contains(&trail) && trail != 0x7f
        };
        if !valid {
            return Err("Invalid GB2312/GBK byte sequence".into());
        }
        index += 2;
    }
    Ok(())
}
