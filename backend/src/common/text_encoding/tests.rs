use super::*;

fn corpus() -> Vec<serde_json::Value> {
    serde_json::from_str(include_str!(
        "../../../test-data/text-encodings/corpus.json"
    ))
    .unwrap()
}

fn bytes(hex: &str) -> Vec<u8> {
    hex.as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}

#[test]
fn decodes_every_required_encoding_against_independent_reference_bytes() {
    let labels: Vec<String> =
        serde_json::from_str(include_str!("../../../../shared/text-encodings.json")).unwrap();
    assert_eq!(
        labels,
        TextEncoding::ALL
            .iter()
            .map(|encoding| encoding.name())
            .collect::<Vec<_>>()
    );
    let fixtures = corpus();
    assert_eq!(fixtures.len(), TextEncoding::ALL.len());
    for fixture in fixtures {
        let label = fixture["encoding"].as_str().unwrap();
        let encoding = TextEncoding::for_label(label).unwrap();
        let input = bytes(fixture["hex"].as_str().unwrap());
        let decoded = decode_buffer(&input, Some(encoding))
            .unwrap_or_else(|error| panic!("{label}: {error}"));
        assert_eq!(decoded.text, fixture["text"].as_str().unwrap(), "{label}");
        assert_eq!(decoded.guess.encoding, encoding);
    }
}

#[test]
fn bom_is_authoritative_and_removed_exactly_once() {
    for (encoding, bom) in [
        (TextEncoding::Utf16Le, vec![0xff, 0xfe]),
        (TextEncoding::Utf16Be, vec![0xfe, 0xff]),
    ] {
        let mut input = bom;
        for unit in "a\u{1f600}\r\n\u{65e5}\u{672c}\u{8a9e}".encode_utf16() {
            input.extend_from_slice(&if encoding == TextEncoding::Utf16Le {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            });
        }
        let decoded = decode_buffer(&input, None).unwrap();
        assert_eq!(decoded.text, "a\u{1f600}\r\n\u{65e5}\u{672c}\u{8a9e}");
        assert_eq!(decoded.guess.encoding, encoding);
        assert_eq!(decoded.guess.method, "bom");
        assert_eq!(decoded.guess.confidence, 1.0);
    }
    let decoded = decode_buffer(b"\xef\xbb\xbf\xef\xbb\xbftext", None).unwrap();
    assert_eq!(decoded.text, "\u{feff}text");
    assert!(decode_buffer(b"\xff\xfea\0", Some(TextEncoding::Utf16Be)).is_err());
}

#[test]
fn recognizes_utf16_without_bom_before_testing_binary_nuls() {
    for (encoding, input) in [
        (TextEncoding::Utf16Le, b"h\0e\0l\0l\0o\0\n\0".as_slice()),
        (TextEncoding::Utf16Be, b"\0h\0e\0l\0l\0o\0\n"),
    ] {
        let decoded = decode_buffer(input, None).unwrap();
        assert_eq!(decoded.text, "hello\n");
        assert_eq!(decoded.guess.encoding, encoding);
    }
}

#[test]
fn malformed_sequences_never_silently_replace_data() {
    for (encoding, input) in [
        (TextEncoding::Utf8, vec![0xc3]),
        (TextEncoding::Utf16Le, vec![1]),
        (TextEncoding::Utf16Be, vec![0xd8, 0x00]),
        (TextEncoding::ShiftJis, vec![0x82]),
        (TextEncoding::Gb18030, vec![0x81, 0x30, 0x81]),
        (TextEncoding::Gbk, vec![0x81, 0x30, 0x81, 0x30]),
    ] {
        assert!(
            decode_buffer(&input, Some(encoding)).is_err(),
            "{encoding:?}"
        );
    }
    assert!(decode_buffer(b"\xef\xbb\xbf\xc3", None).is_err());
    assert!(
        decode_buffer(b"\xff\xfe\0\0A\0\0\0", None).is_err(),
        "Reject UTF-32 before matching UTF-16 BOM"
    );
}

#[test]
fn iso_encodings_preserve_c1_controls_and_are_not_windows_aliases() {
    for encoding in [
        TextEncoding::Iso8859_1,
        TextEncoding::Iso8859_9,
        TextEncoding::Iso8859_11,
    ] {
        assert_eq!(
            decode_buffer(&[0x80, 0x91], Some(encoding)).unwrap().text,
            "\u{80}\u{91}"
        );
    }
    assert_eq!(
        decode_buffer(&[0x80, 0x91], Some(TextEncoding::Windows1252))
            .unwrap()
            .text,
        "\u{20ac}\u{2018}"
    );
}

#[test]
fn gb2312_punctuation_is_distinct_from_gbk_and_gb18030() {
    let bytes = [0xa1, 0xa4, 0xa1, 0xaa];
    assert_eq!(
        decode_buffer(&bytes, Some(TextEncoding::Gb2312))
            .unwrap()
            .text,
        "\u{30fb}\u{2015}"
    );
    assert_eq!(
        decode_buffer(&bytes, Some(TextEncoding::Gbk)).unwrap().text,
        "\u{b7}\u{2014}"
    );
}

#[test]
fn honors_supported_coding_declarations_and_reports_ambiguity() {
    let decoded = decode_buffer(b"# coding: cp437\ncaf\x82\n", None).unwrap();
    assert_eq!(decoded.text, "# coding: cp437\ncaf\u{e9}\n");
    assert_eq!(decoded.guess.encoding, TextEncoding::Ibm437);
    assert_eq!(decoded.guess.method, "declaration");
    let guess = guess_encoding(b"plain ASCII\n").unwrap();
    assert_eq!(guess.encoding, TextEncoding::Utf8);
    assert!(guess.confidence <= 0.5);
    assert!(guess.alternatives.contains(&TextEncoding::Ibm865));
    assert_eq!(decode_buffer(b"", None).unwrap().text, "");
    assert!(
        decode_buffer(b"# coding: utf-16le\nplain ASCII text!!\n", None).is_err(),
        "An ASCII declaration must not reinterpret plain ASCII as UTF-16"
    );
}

#[test]
fn legacy_detection_is_readable_and_provides_supported_alternatives() {
    for fixture in corpus()
        .into_iter()
        .filter(|fixture| !fixture["encoding"].as_str().unwrap().starts_with("UTF"))
    {
        let input = bytes(fixture["hex"].as_str().unwrap());
        let decoded = decode_buffer(&input, None).unwrap();
        assert_eq!(
            decoded.text,
            fixture["text"].as_str().unwrap(),
            "{} guessed {:?}",
            fixture["encoding"],
            decoded.guess
        );
        assert!(decoded.guess.confidence < 1.0);
    }
}

#[test]
fn refuses_binary_signatures_nuls_and_control_heavy_data() {
    for input in [
        b"\x89PNG\r\n\x1a\n".as_slice(),
        b"PK\x03\x04compressed",
        b"%PDF-1.7",
        b"a\0binary",
        b"\x01\x02\x03\n",
    ] {
        assert!(decode_buffer(input, None).is_err());
    }
}

#[test]
fn buffer_detection_uses_late_non_ascii_evidence_after_a_long_ascii_header() {
    let fixture = corpus()
        .into_iter()
        .find(|fixture| fixture["encoding"] == "Windows-1251")
        .unwrap();
    let mut input = vec![b'a'; 70000];
    input.extend(bytes(fixture["hex"].as_str().unwrap()));
    let decoded = decode_buffer(&input, None).unwrap();
    assert_eq!(decoded.guess.encoding, TextEncoding::Windows1251);
    assert!(decoded.text.ends_with(fixture["text"].as_str().unwrap()));
}
