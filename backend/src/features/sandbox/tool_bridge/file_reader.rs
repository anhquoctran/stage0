use super::{
    FileRangeResult, HARD_MAX_TOOL_OUTPUT_BYTES, MAX_TOOL_FILE_SCAN_BYTES,
    TOOL_OUTPUT_TRUNCATION_NOTICE,
};
use std::io::{BufRead, BufReader};

/// Reads only the requested line range, retaining at most the configured
/// response size and scanning at most 64 MiB. It never accumulates the file or
/// an individual giant line in memory.
pub(super) fn read_file_range<R: BufRead>(
    reader: &mut R,
    start_line: usize,
    end_line: usize,
    output_limit: usize,
) -> Result<FileRangeResult, String> {
    let decoded = crate::common::text_encoding::TextReader::new(reader, MAX_TOOL_FILE_SCAN_BYTES)
        .map_err(|_| "File is binary, malformed or exceeds the text read safety limit")?;
    read_utf8_range(
        &mut BufReader::new(decoded),
        start_line,
        end_line,
        output_limit,
    )
}

fn read_utf8_range<R: BufRead>(
    reader: &mut R,
    start_line: usize,
    end_line: usize,
    output_limit: usize,
) -> Result<FileRangeResult, String> {
    let output_limit = output_limit.min(HARD_MAX_TOOL_OUTPUT_BYTES);
    let content_limit = output_limit.saturating_sub(TOOL_OUTPUT_TRUNCATION_NOTICE.len());
    let mut output = Vec::with_capacity(content_limit.min(16 * 1024));
    let mut line_number = 1usize;
    let mut completed_lines = 0usize;
    let mut selected_lines = 0usize;
    let mut line_started = false;
    let mut current_line_has_bytes = false;
    let mut output_truncated = false;
    let mut scanned_bytes = 0usize;

    loop {
        let available = reader.fill_buf().map_err(|error| {
            crate::common::messages::failure(
                "backend.sandbox.readFileRangeFailed",
                serde_json::json!({ "error": error.to_string() }),
                format!("Failed to read file range: {}", error),
            )
        })?;
        if available.is_empty() {
            if current_line_has_bytes {
                completed_lines += 1;
            }
            let actual_end_line = end_line.min(completed_lines);
            let mut content = utf8_prefix(&output);
            if output_truncated {
                content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
            }
            return Ok(FileRangeResult {
                content,
                total_lines: Some(completed_lines),
                actual_end_line,
                output_truncated,
            });
        }

        if scanned_bytes >= MAX_TOOL_FILE_SCAN_BYTES {
            if line_number < end_line {
                return Err(crate::common::messages::code(
                    "backend.sandbox.fileRangeTooLarge",
                ));
            }
            output_truncated = true;
            let mut content = utf8_prefix(&output);
            content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
            return Ok(FileRangeResult {
                content,
                total_lines: None,
                actual_end_line: line_number.min(end_line),
                output_truncated,
            });
        }

        let scan_count = available
            .len()
            .min(MAX_TOOL_FILE_SCAN_BYTES - scanned_bytes);
        let scanned = &available[..scan_count];
        let newline_at = scanned.iter().position(|byte| *byte == b'\n');
        let content_count = newline_at.unwrap_or(scanned.len());
        let line_selected = line_number >= start_line && line_number <= end_line;

        if line_selected {
            if !line_started {
                if selected_lines > 0 && !output_truncated {
                    if output.len() < content_limit {
                        output.push(b'\n');
                    } else {
                        output_truncated = true;
                    }
                }
                selected_lines += 1;
                line_started = true;
            }

            if !output_truncated {
                let remaining = content_limit.saturating_sub(output.len());
                let keep = content_count.min(remaining);
                output.extend_from_slice(&scanned[..keep]);
                if keep < content_count {
                    output_truncated = true;
                }
            }
        }
        current_line_has_bytes |= content_count > 0;

        let consumed = content_count + usize::from(newline_at.is_some());
        reader.consume(consumed);
        scanned_bytes += consumed;

        if newline_at.is_some() {
            if line_selected && output.last() == Some(&b'\r') {
                output.pop();
            }
            completed_lines += 1;
            line_number += 1;
            current_line_has_bytes = false;
            line_started = false;

            if line_number > end_line {
                let more = reader.fill_buf().map_err(|error| {
                    crate::common::messages::failure(
                        "backend.sandbox.inspectFileRangeFailed",
                        serde_json::json!({ "error": error.to_string() }),
                        format!("Failed to inspect file range: {}", error),
                    )
                })?;
                let total_lines = if more.is_empty() {
                    Some(completed_lines)
                } else {
                    None
                };
                let mut content = utf8_prefix(&output);
                if output_truncated {
                    content.push_str(TOOL_OUTPUT_TRUNCATION_NOTICE);
                }
                return Ok(FileRangeResult {
                    content,
                    total_lines,
                    actual_end_line: end_line,
                    output_truncated,
                });
            }
        }
    }
}

fn utf8_prefix(bytes: &[u8]) -> String {
    let end = std::str::from_utf8(bytes)
        .map(|_| bytes.len())
        .unwrap_or_else(|error| error.valid_up_to());
    String::from_utf8(bytes[..end].to_vec()).expect("validated UTF-8 prefix")
}
