/// A conservative tie-breaker for the statistical detector: reward readable
/// letters, penalize controls/mojibake, and prefer coherent writing systems.
pub(super) fn readability(text: &str) -> f32 {
    let characters: Vec<_> = text.chars().collect();
    let mut scripts = [0usize; 8];
    let mut score = 0.0;
    let mut non_ascii = 0;
    let mut boxes = 0;
    for (index, &character) in characters.iter().enumerate().filter(|(_, c)| !c.is_ascii()) {
        non_ascii += 1;
        let scalar = character as u32;
        let script = match scalar {
            0x00c0..=0x02af | 0x1e00..=0x1eff => Some(0),
            0x0370..=0x03ff => Some(1),
            0x0400..=0x052f => Some(2),
            0x0590..=0x05ff => Some(3),
            0x0600..=0x06ff => Some(4),
            0x0e00..=0x0e7f => Some(5),
            0x3040..=0x30ff | 0x3400..=0x9fff => Some(6),
            0xac00..=0xd7af => Some(7),
            _ => None,
        };
        if let Some(script) = script {
            scripts[script] += 1;
        }
        if character.is_control() || character == '\u{fffd}' {
            score -= 12.0;
        } else if character.is_alphabetic() || (0x0300..=0x036f).contains(&scalar) {
            score += 1.0;
        } else if (0x2500..=0x259f).contains(&scalar) {
            boxes += 1;
            score -= 0.6;
        } else if matches!(
            character,
            '\u{201c}' | '\u{201d}' | '\u{2018}' | '\u{2019}' | '\u{20ac}' | '\u{2026}' | '\u{a0}'
        ) {
            score += 0.4;
        } else {
            score -= 0.7;
        }
        if matches!(
            character,
            '\u{201a}' | '\u{201e}' | '\u{2021}' | '\u{2030}' | '\u{2c6}' | '\u{2020}'
        ) && index > 0
            && characters[index - 1].is_alphabetic()
            && characters.get(index + 1).is_some_and(|c| c.is_alphabetic())
        {
            score -= 4.0;
        }
        if character.is_uppercase() && index > 0 && characters[index - 1].is_lowercase() {
            score -= 2.0;
        }
        if (0x0370..=0x052f).contains(&scalar)
            && ((index > 0 && characters[index - 1].is_ascii_alphabetic())
                || characters
                    .get(index + 1)
                    .is_some_and(|c| c.is_ascii_alphabetic()))
        {
            score -= 4.0;
        }
    }
    if non_ascii == 0 {
        return 0.0;
    }
    let letters: usize = scripts.iter().sum();
    let dominant = scripts.iter().max().copied().unwrap_or(0);
    score -= (letters - dominant) as f32 * 1.5;
    if boxes >= 3 {
        score += boxes as f32 * 1.1;
    }
    score / non_ascii as f32 - alphabet_mismatch(text)
}

pub(super) fn vietnamese_tones(text: &str) -> usize {
    text.chars()
        .zip(text.chars().skip(1))
        .filter(|(vowel, tone)| {
            "AEIOUYaeiouy\u{102}\u{103}\u{c2}\u{e2}\u{ca}\u{ea}\u{d4}\u{f4}\u{1a0}\u{1a1}\u{1af}\u{1b0}".contains(*vowel)
                && matches!(
                    tone,
                    '\u{300}' | '\u{301}' | '\u{303}' | '\u{309}' | '\u{323}'
                )
        })
        .count()
}

pub(super) fn binary_signature(bytes: &[u8]) -> bool {
    [
        b"\x89PNG".as_slice(),
        b"\xff\xd8\xff",
        b"GIF87a",
        b"GIF89a",
        b"PK\x03\x04",
        b"PK\x05\x06",
        b"\x1f\x8b",
        b"\x7fELF",
        b"\0asm",
        b"%PDF-",
        b"SQLite format 3\0",
        b"\xca\xfe\xba\xbe",
        b"\xcf\xfa\xed\xfe",
        b"\xfe\xed\xfa\xcf",
    ]
    .iter()
    .any(|signature| bytes.starts_with(signature))
}

pub(super) fn control_heavy(text: &str) -> bool {
    let mut count = 0usize;
    let mut controls = 0usize;
    for character in text.chars() {
        count += 1;
        if character == '\0' {
            return true;
        }
        if character.is_control() && !matches!(character, '\n' | '\r' | '\t' | '\u{c}') {
            controls += 1;
        }
    }
    controls > 0 && controls.saturating_mul(100) > count
}

// Compare Latin diacritics with common alphabet repertoires. This supplements
// browser models for Baltic, OEM and Macintosh codecs without a word whitelist.
fn alphabet_mismatch(text: &str) -> f32 {
    let mut counts = std::collections::BTreeMap::new();
    for character in text
        .chars()
        .flat_map(char::to_lowercase)
        .filter(|c| !c.is_ascii() && c.is_alphabetic())
    {
        if !matches!(character as u32, 0x00aa | 0x00ba | 0x00c0..=0x02af | 0x1e00..=0x1eff) {
            return 0.0;
        }
        *counts.entry(character).or_insert(0usize) += 1;
    }
    let total: usize = counts.values().sum();
    if total < 2 {
        return 0.0;
    }
    let repertoires = [
        "\u{e0}\u{e2}\u{e6}\u{e7}\u{e9}\u{e8}\u{ea}\u{eb}\u{ee}\u{ef}\u{f4}\u{153}\u{f9}\u{fb}\u{fc}\u{ff}",
        "\u{e1}\u{e9}\u{ed}\u{f1}\u{f3}\u{fa}\u{fc}",
        "\u{e1}\u{e2}\u{e3}\u{e0}\u{e7}\u{e9}\u{ea}\u{ed}\u{f3}\u{f4}\u{f5}\u{fa}",
        "\u{e4}\u{f6}\u{fc}\u{df}",
        "\u{e5}\u{e6}\u{f8}\u{e4}\u{f6}\u{e9}",
        "\u{105}\u{107}\u{119}\u{142}\u{144}\u{f3}\u{15b}\u{17a}\u{17c}",
        "\u{e1}\u{10d}\u{10f}\u{e9}\u{11b}\u{ed}\u{148}\u{f3}\u{159}\u{161}\u{165}\u{fa}\u{16f}\u{fd}\u{17e}\u{e4}\u{13a}\u{13e}\u{155}\u{f4}",
        "\u{e1}\u{e9}\u{ed}\u{f3}\u{f6}\u{151}\u{fa}\u{fc}\u{171}",
        "\u{101}\u{10d}\u{113}\u{123}\u{12b}\u{137}\u{13c}\u{146}\u{161}\u{16b}\u{17e}",
        "\u{105}\u{10d}\u{119}\u{117}\u{12f}\u{161}\u{173}\u{16b}\u{17e}",
        "\u{e4}\u{f6}\u{f5}\u{161}\u{fc}\u{17e}",
        "\u{e7}\u{11f}\u{131}\u{f6}\u{15f}\u{fc}",
        "\u{103}\u{e2}\u{111}\u{ea}\u{f4}\u{1a1}\u{1b0}",
        "\u{103}\u{e2}\u{ee}\u{219}\u{15f}\u{21b}\u{163}",

    ];
    let best = repertoires
        .iter()
        .map(|repertoire| {
            counts
                .iter()
                .filter(|(character, _)| repertoire.contains(**character))
                .map(|(_, count)| *count)
                .sum::<usize>()
        })
        .max()
        .unwrap_or(0);
    4.0 * (1.0 - best as f32 / total as f32)
}
