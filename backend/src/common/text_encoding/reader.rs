use super::{codec, guess_encoding, EncodingGuess, TextEncoding};
use std::io::{self, Chain, Cursor, Read};

/// Decode once per file, not once per line/chunk. Both sampling and pending
/// output remain bounded; split multibyte sequences retain decoder state.
pub struct TextReader<R: Read> {
    input: Chain<Cursor<Vec<u8>>, R>,
    decoder: Option<encoding_rs::Decoder>,
    pub guess: EncodingGuess,
    output: Cursor<Vec<u8>>,
    remaining: usize,
    eof: bool,
    chinese_lead: Option<u8>,
    awaiting_non_ascii: bool,
}

impl<R: Read> TextReader<R> {
    pub fn new(mut reader: R, limit: usize) -> io::Result<Self> {
        let sample_limit = limit.min(64 * 1024);
        let mut prefix = Vec::with_capacity(sample_limit);
        reader
            .by_ref()
            .take(sample_limit as u64)
            .read_to_end(&mut prefix)?;
        let complete = prefix.len() < sample_limit;
        // At a bounded sample boundary only, allow an unfinished codepoint.
        let utf8_end = if !complete && codec::bom(&prefix).is_none() {
            std::str::from_utf8(&prefix)
                .err()
                .filter(|error| error.error_len().is_none())
                .map(|error| error.valid_up_to())
        } else {
            None
        };
        let detected = utf8_end.map(|end| &prefix[..end]).unwrap_or(&prefix);
        let guess = (0..=if complete { 0 } else { 3 })
            .find_map(|trim| guess_encoding(&detected[..detected.len().saturating_sub(trim)]).ok())
            .ok_or_else(|| invalid("File is binary or its encoding cannot be detected"))?;
        let bom_length = codec::bom(&prefix).map(|(_, count)| count).unwrap_or(0);
        prefix.drain(..bom_length);
        let decoder = decoder_for(guess.encoding);
        let awaiting_non_ascii = guess.confidence <= 0.5 && guess.method == "utf8-validation";
        Ok(Self {
            input: Cursor::new(prefix).chain(reader),
            decoder,
            guess,
            output: Cursor::new(Vec::new()),
            remaining: limit.saturating_sub(bom_length),
            eof: false,
            chinese_lead: None,
            awaiting_non_ascii,
        })
    }

    fn fill(&mut self) -> io::Result<()> {
        let mut bytes = vec![0u8; 8192];
        let maximum = bytes.len().min(self.remaining.saturating_add(1));
        let count = self.input.read(&mut bytes[..maximum])?;
        if count > self.remaining {
            return Err(invalid("File exceeds the text scan safety limit"));
        }
        self.remaining -= count;
        self.eof = count == 0;
        bytes.truncate(count);
        // An ASCII-only prefix is shared by all legacy encodings. Defer its
        // final choice until the first non-ASCII bytes, without buffering the
        // intervening megabytes of ASCII or guessing independently per line.
        if self.awaiting_non_ascii && !bytes.is_ascii() {
            let additional_limit = (64 * 1024 - count).min(self.remaining.saturating_add(1));
            let extra = self
                .input
                .by_ref()
                .take(additional_limit as u64)
                .read_to_end(&mut bytes)?;
            if extra > self.remaining {
                return Err(invalid("File exceeds the text scan safety limit"));
            }
            self.remaining -= extra;
            self.eof = extra < additional_limit;
            let sample = bytes.as_slice();
            let end = std::str::from_utf8(sample)
                .err()
                .filter(|error| error.error_len().is_none())
                .map(|error| error.valid_up_to())
                .unwrap_or(sample.len());
            self.guess = guess_encoding(&sample[..end])
                .map_err(|_| invalid("Cannot detect text encoding after ASCII prefix"))?;
            if matches!(
                self.guess.encoding,
                TextEncoding::Utf16Le | TextEncoding::Utf16Be
            ) {
                return Err(invalid("Text encoding changed after ASCII prefix"));
            }
            if self.guess.encoding == TextEncoding::Utf8Bom {
                self.guess.encoding = TextEncoding::Utf8;
                self.guess.bom = false;
            }
            self.decoder = decoder_for(self.guess.encoding);
            self.awaiting_non_ascii = false;
        }
        let count = bytes.len();
        if matches!(
            self.guess.encoding,
            TextEncoding::Gb2312 | TextEncoding::Gbk
        ) {
            let mut check = Vec::with_capacity(count + 1);
            check.extend(self.chinese_lead.take());
            check.extend_from_slice(&bytes[..count]);
            let mut index = 0;
            while index < check.len() {
                if check[index] < 0x80
                    || (check[index] == 0x80 && self.guess.encoding == TextEncoding::Gbk)
                {
                    index += 1;
                } else if index + 1 == check.len() && !self.eof {
                    self.chinese_lead = Some(check[index]);
                    check.pop();
                    break;
                } else {
                    index += 2;
                }
            }
            codec::validate_chinese(&check, self.guess.encoding)
                .map_err(|_| invalid("Invalid Chinese byte sequence"))?;
        }
        let text = if let Some(decoder) = &mut self.decoder {
            let mut text = String::with_capacity(count.saturating_mul(4).saturating_add(16));
            let (result, consumed) =
                decoder.decode_to_string_without_replacement(&bytes[..count], &mut text, self.eof);
            if !matches!(result, encoding_rs::DecoderResult::InputEmpty) || consumed != count {
                return Err(invalid("Invalid byte sequence in text file"));
            }
            text
        } else {
            codec::decode_payload(&bytes[..count], self.guess.encoding)
                .map_err(|_| invalid("Invalid text encoding"))?
        };
        if text.contains('\0') {
            return Err(invalid("Binary NUL in text file"));
        }
        self.output =
            Cursor::new(codec::chinese_characters(text, self.guess.encoding).into_bytes());
        Ok(())
    }
}

fn decoder_for(encoding: TextEncoding) -> Option<encoding_rs::Decoder> {
    match encoding {
        TextEncoding::Iso8859_1
        | TextEncoding::Iso8859_9
        | TextEncoding::Iso8859_11
        | TextEncoding::Ibm437
        | TextEncoding::Ibm850
        | TextEncoding::Ibm852
        | TextEncoding::Ibm865 => None,
        _ => encoding
            .codec()
            .map(|codec| codec.new_decoder_without_bom_handling()),
    }
}

impl<R: Read> Read for TextReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }
        loop {
            let count = self.output.read(buffer)?;
            if count > 0 || self.eof {
                return Ok(count);
            }
            self.fill()?;
        }
    }
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
