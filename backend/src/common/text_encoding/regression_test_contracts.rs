use super::{decode_buffer, TextEncoding};

#[test]
fn every_previously_supported_codec_still_decodes_the_independent_reference_bytes() {
    let corpus: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../../test-data/text-encodings/corpus.json"
    ))
    .unwrap();
    assert!(corpus.len() >= 40);
    for fixture in corpus {
        let label = fixture["encoding"].as_str().unwrap();
        let codec = TextEncoding::for_label(label).unwrap();
        let hex = fixture["hex"].as_str().unwrap();
        let bytes: Vec<u8> = hex
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
            .collect();
        assert_eq!(
            decode_buffer(&bytes, Some(codec)).unwrap().text,
            fixture["text"].as_str().unwrap(),
            "{label}"
        );
    }
}

#[test]
fn malformed_utf8_and_utf16_never_silently_replace_or_discard_data() {
    for (bytes, codec) in [
        (&[0xff][..], TextEncoding::Utf8),
        (&[0xff, 0xfe, 0x41][..], TextEncoding::Utf16Le),
    ] {
        assert!(decode_buffer(bytes, Some(codec)).is_err());
    }
}
