use super::{codec, scoring, EncodingGuess, TextEncoding};

const SAMPLE_BYTES: usize = 64 * 1024;

pub fn guess_encoding(bytes: &[u8]) -> Result<EncodingGuess, String> {
    if bytes.starts_with(&[0xff, 0xfe, 0, 0]) || bytes.starts_with(&[0, 0, 0xfe, 0xff]) {
        return Err("UTF-32 is not a supported text encoding".into());
    }
    if scoring::binary_signature(bytes) {
        return Err("Binary file cannot be decoded as text".into());
    }
    if let Some((encoding, _)) = codec::bom(bytes) {
        let text = codec::decode(bytes, encoding)?;
        if scoring::control_heavy(&text) {
            return Err("Binary data after text BOM".into());
        }
        return Ok(guess(encoding, 1.0, "bom", true));
    }
    if let Some(encoding) = utf16_structure(bytes) {
        if let Ok(text) = codec::decode(bytes, encoding) {
            if !scoring::control_heavy(&text) {
                return Ok(guess(encoding, 0.8, "utf16-structure", false));
            }
        }
    }
    if bytes.contains(&0) {
        return Err("Binary file contains NUL bytes".into());
    }
    if let Some(encoding) = declaration(bytes) {
        if matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be) {
            return Err("Declared UTF-16 requires a BOM or UTF-16 byte structure".into());
        }
        let text = codec::decode(bytes, encoding)?;
        if scoring::control_heavy(&text) {
            return Err("Declared encoding contains binary controls".into());
        }
        return Ok(guess(encoding, 0.95, "declaration", false));
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        if scoring::control_heavy(text) {
            return Err("Binary file contains control characters".into());
        }
        let mut result = guess(
            TextEncoding::Utf8,
            if bytes.is_ascii() { 0.5 } else { 0.95 },
            "utf8-validation",
            false,
        );
        if bytes.is_ascii() {
            result.alternatives = TextEncoding::ALL
                .into_iter()
                .filter(|encoding| {
                    !matches!(
                        encoding,
                        TextEncoding::Utf8
                            | TextEncoding::Utf8Bom
                            | TextEncoding::Utf16Le
                            | TextEncoding::Utf16Be
                    )
                })
                .collect();
        }
        return Ok(result);
    }
    let prefix = &bytes[..bytes.len().min(SAMPLE_BYTES)];
    let start = if prefix.is_ascii() && bytes.len() > prefix.len() {
        bytes
            .iter()
            .position(|byte| !byte.is_ascii())
            .unwrap_or(0)
            .saturating_sub(1024)
    } else {
        0
    };
    let end = bytes.len().min(start.saturating_add(SAMPLE_BYTES));
    let sample = &bytes[start..end];
    let sample_complete = end == bytes.len();
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(sample, sample_complete);
    let (preferred, reliable) = detector.guess_assess(None, false);
    let mut preferred = TextEncoding::for_label(preferred.name());
    // chardetng reports GBK for the Chinese family. WHATWG's GBK decoder also
    // accepts GB18030 four-byte sequences; retain the actual required codec.
    if preferred == Some(TextEncoding::Gbk)
        && codec::decode(sample, TextEncoding::Gbk).is_err()
        && codec::decode(sample, TextEncoding::Gb18030).is_ok()
    {
        preferred = Some(TextEncoding::Gb18030);
    }
    let mut candidates = Vec::new();
    for encoding in TextEncoding::ALL {
        if matches!(encoding, TextEncoding::Utf8 | TextEncoding::Utf8Bom) {
            continue;
        }
        // A bounded prefix can end inside a multibyte character; trim at most
        // three bytes only for sampling, never when decoding the actual file.
        let decoded = (0..=if sample_complete { 0 } else { 3 }).find_map(|trim| {
            codec::decode(&sample[..sample.len().saturating_sub(trim)], encoding).ok()
        });
        if let Some(text) = decoded.filter(|text| !scoring::control_heavy(text)) {
            let mut prior = if Some(encoding) == preferred {
                1.25
            } else {
                0.0
            };
            if encoding == TextEncoding::Windows1258
                && scoring::vietnamese_tones(&text) >= 2
                && matches!(
                    preferred,
                    Some(
                        TextEncoding::Windows1250
                            | TextEncoding::Windows1252
                            | TextEncoding::Windows1254
                            | TextEncoding::Windows1258
                    )
                )
            {
                prior += 1.5;
            }
            if encoding == TextEncoding::Iso8859_15
                && text.contains('\u{20ac}')
                && !sample.contains(&0x80)
            {
                prior += 1.5;
            }
            if matches!(encoding, TextEncoding::Utf16Le | TextEncoding::Utf16Be) {
                prior -= 1.0;
            }
            candidates.push((encoding, scoring::readability(&text) + prior));
        }
    }
    candidates.sort_by(|a, b| b.1.total_cmp(&a.1));
    let &(encoding, score) = candidates
        .first()
        .ok_or("No plausible supported text encoding")?;
    let margin = candidates
        .get(1)
        .map(|candidate| score - candidate.1)
        .unwrap_or(0.0);
    let mut result = guess(
        encoding,
        if reliable && margin > 0.8 {
            0.65
        } else if margin > 0.3 {
            0.6
        } else {
            0.35
        },
        "statistical",
        false,
    );
    result.alternatives = candidates
        .into_iter()
        .skip(1)
        .map(|candidate| candidate.0)
        .collect();
    Ok(result)
}

fn guess(
    encoding: TextEncoding,
    confidence: f32,
    method: &'static str,
    bom: bool,
) -> EncodingGuess {
    EncodingGuess {
        encoding,
        confidence,
        method,
        bom,
        alternatives: Vec::new(),
    }
}

fn utf16_structure(bytes: &[u8]) -> Option<TextEncoding> {
    if bytes.len() < 4 || bytes.len() % 2 != 0 {
        return None;
    }
    let sample = &bytes[..bytes.len().min(SAMPLE_BYTES)];
    let pairs = sample.len() / 2;
    let even = sample.iter().step_by(2).filter(|byte| **byte == 0).count();
    let odd = sample
        .iter()
        .skip(1)
        .step_by(2)
        .filter(|byte| **byte == 0)
        .count();
    if (odd * 5 >= pairs * 3 || (odd >= 3 && odd * 20 >= pairs)) && even * 10 <= pairs {
        Some(TextEncoding::Utf16Le)
    } else if (even * 5 >= pairs * 3 || (even >= 3 && even * 20 >= pairs)) && odd * 10 <= pairs {
        Some(TextEncoding::Utf16Be)
    } else {
        None
    }
}

fn declaration(bytes: &[u8]) -> Option<TextEncoding> {
    // Respect conventional coding cookies / XML or HTML declarations only in
    // the leading two lines, not an arbitrary string literal deep in source.
    let prefix: String = bytes
        .iter()
        .take(1024)
        .map(|byte| {
            if byte.is_ascii() {
                char::from(*byte)
            } else {
                ' '
            }
        })
        .collect();
    for line in prefix.lines().take(2) {
        let lower = line.to_ascii_lowercase();
        if !(lower.trim_start().starts_with(['#', ';'])
            || lower.contains("<?xml")
            || lower.contains("<meta")
            || lower.trim_start().starts_with("//"))
        {
            continue;
        }
        for marker in ["coding", "encoding", "charset"] {
            let Some(start) = lower.find(marker) else {
                continue;
            };
            let tail = lower[start + marker.len()..].trim_start();
            if !tail.starts_with([':', '=']) {
                continue;
            }
            let label: String = tail[1..]
                .trim_start()
                .trim_start_matches(['\'', '"'])
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
                .collect();
            if let Some(encoding) = TextEncoding::for_label(&label) {
                return Some(encoding);
            }
        }
    }
    None
}
