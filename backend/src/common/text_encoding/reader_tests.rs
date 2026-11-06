use super::*;
use std::io::{Cursor, Read};

#[test]
fn decodes_streams_for_the_complete_reference_catalog() {
    let corpus: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../../test-data/text-encodings/corpus.json"
    ))
    .unwrap();
    for fixture in corpus {
        let label = fixture["encoding"].as_str().unwrap();
        let hex = fixture["hex"].as_str().unwrap();
        let mut input: Vec<u8> = hex
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
            .collect();
        let mut expected = fixture["text"].as_str().unwrap().to_owned();
        match TextEncoding::for_label(label).unwrap() {
            TextEncoding::Utf16Le => {
                input.splice(..0, [0xff, 0xfe]);
            }
            TextEncoding::Utf16Be => {
                input.splice(..0, [0xfe, 0xff]);
            }
            TextEncoding::Utf8 | TextEncoding::Utf8Bom => {}
            _ => {
                let cookie = format!("# coding: {}\n", label.replace(' ', "_"));
                input.splice(..0, cookie.bytes());
                expected = format!("{cookie}{expected}");
            }
        }
        let mut reader = TextReader::new(Cursor::new(&input), input.len()).unwrap();
        let mut output = String::new();
        reader
            .read_to_string(&mut output)
            .unwrap_or_else(|error| panic!("{label}: {error}"));
        assert_eq!(output, expected, "{label}");
    }
}

#[test]
fn handles_partial_utf8_and_utf16_at_sample_and_decoder_boundaries() {
    let mut input = vec![b'a'; 65535];
    input.extend_from_slice("\u{1f600}\u{65e5}\u{672c}\u{8a9e}\n".as_bytes());
    let mut output = String::new();
    TextReader::new(Cursor::new(&input), input.len())
        .unwrap()
        .read_to_string(&mut output)
        .unwrap();
    assert_eq!(output.as_bytes(), input);
    let source = format!("{}\u{1f600}\u{65e5}\u{672c}\u{8a9e}\n", "a".repeat(32766));
    let mut input = vec![0xff, 0xfe];
    for unit in source.encode_utf16() {
        input.extend_from_slice(&unit.to_le_bytes());
    }
    output.clear();
    TextReader::new(Cursor::new(&input), input.len())
        .unwrap()
        .read_to_string(&mut output)
        .unwrap();
    assert_eq!(output, source);
}

#[test]
fn enforces_raw_byte_limit_and_rejects_malformed_later_chunks() {
    let mut input = vec![0xef, 0xbb, 0xbf];
    input.extend_from_slice(&vec![b'a'; 70000]);
    let mut output = String::new();
    assert!(TextReader::new(Cursor::new(&input), input.len() - 1)
        .unwrap()
        .read_to_string(&mut output)
        .is_err());
    input.push(0xff);
    output.clear();
    assert!(TextReader::new(Cursor::new(&input), input.len())
        .unwrap()
        .read_to_string(&mut output)
        .is_err());
    assert!(!output.contains('\u{fffd}'));
}

#[test]
fn detects_legacy_bytes_after_a_large_shared_ascii_prefix() {
    let mut bytes = vec![b'a'; 70000];
    bytes.extend_from_slice(b"\ncaf\xe9 d\xe9j\xe0 pr\xeat. Fran\xe7ois \xe9crit une lettre.\n");
    let mut output = String::new();
    let mut reader = TextReader::new(Cursor::new(&bytes), bytes.len()).unwrap();
    reader.read_to_string(&mut output).unwrap();
    assert!(output
        .ends_with("\ncaf\u{e9} d\u{e9}j\u{e0} pr\u{ea}t. Fran\u{e7}ois \u{e9}crit une lettre.\n"));
    assert_eq!(reader.guess.encoding, TextEncoding::Windows1252);
}

#[test]
fn streamed_gb2312_keeps_its_original_punctuation_mapping() {
    let input = b"# coding: gb2312\n\xa1\xa4\xa1\xaa\n";
    let mut output = String::new();
    TextReader::new(Cursor::new(input), input.len())
        .unwrap()
        .read_to_string(&mut output)
        .unwrap();
    assert_eq!(output, "# coding: gb2312\n\u{30fb}\u{2015}\n");
}
