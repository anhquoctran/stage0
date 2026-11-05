//! Shared, strict decoding for file bytes, separate from UTF-8 wire protocols.
mod catalog;
mod codec;
mod detector;
mod guess;
mod reader;
mod scoring;
pub use catalog::TextEncoding;
pub use detector::guess_encoding;
pub use guess::EncodingGuess;
pub use reader::TextReader;

#[derive(Debug)]
pub struct DecodedText {
    pub text: String,
    pub guess: EncodingGuess,
}

pub fn decode_buffer(bytes: &[u8], encoding: Option<TextEncoding>) -> Result<DecodedText, String> {
    let guess = if let Some(encoding) = encoding {
        EncodingGuess {
            encoding,
            confidence: 1.0,
            method: "explicit",
            bom: codec::bom(bytes).is_some(),
            alternatives: Vec::new(),
        }
    } else {
        guess_encoding(bytes)?
    };
    let text = codec::decode(bytes, guess.encoding)?;
    if text.contains('\0') {
        return Err("Binary file cannot be decoded as text".into());
    }
    Ok(DecodedText { text, guess })
}

#[cfg(test)]
mod reader_tests;
#[cfg(test)]
mod tests;
