pub(super) struct FileRangeResult {
    pub(super) content: String,
    pub(super) total_lines: Option<usize>,
    pub(super) actual_end_line: usize,
    pub(super) output_truncated: bool,
}
