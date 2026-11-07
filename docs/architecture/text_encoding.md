# Text file decoding and detection

`backend/src/common/text_encoding/` owns byte-to-text conversion for repository
files. `decode_buffer(bytes, Some(TextEncoding))` selects a codec explicitly;
`decode_buffer(bytes, None)` and `guess_encoding(bytes)` detect it. `DecodedText`
contains the decoded string and an `EncodingGuess` with encoding, evidence method,
confidence, BOM presence and ranked alternatives. Conversion never writes the
decoded text back to the source file.

## Supported catalog

| Family | Encodings |
| --- | --- |
| Unicode | UTF-8, UTF-8 with BOM, UTF-16 LE, UTF-16 BE |
| Windows | 1250, 1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258, 874 |
| ISO | 8859-1, 8859-2, 8859-4, 8859-5, 8859-6, 8859-7, 8859-8, 8859-9, 8859-11, 8859-13, 8859-15 |
| Other single-byte | KOI8-R, KOI8-U, IBM437, IBM850, IBM852, IBM865, IBM866, Macintosh |
| East Asian | Shift JIS, EUC-JP, EUC-KR, GB2312, GBK, GB18030, Big5 |

The catalog keeps all 40 requested formats, including the BOM variant, and accepts
common CP/Latin/Mac aliases. `encoding_rs` supplies maintained Unicode, Windows and
East Asian conversions; `oem_cp` supplies the four additional OEM tables.
ISO-8859-1/9/11 retain ISO C1 controls rather than silently taking their browser
Windows aliases. GB2312 retains its two distinct punctuation mappings; GBK and
GB2312 enforce two-byte framing rather than accepting GB18030 four-byte input.
Other East Asian codecs use encoding_rs's WHATWG-compatible variants (including
the CP932/CP949 extensions for Shift JIS/EUC-KR).

## Detection order

1. Reject recognized binary signatures and unsupported UTF-32 BOMs.
2. Honor UTF-8/UTF-16 BOMs, removing exactly one. Validate the complete content;
   a malformed BOM-marked file is an error, never silently reinterpreted.
3. Test UTF-16 byte-lane structure and strict surrogate validity before treating
   NUL bytes as binary. Without a BOM, this remains a heuristic.
4. Honor supported coding cookies, XML encoding or HTML charset declarations in
   the leading two lines / first 1 KiB. Declarations cannot override a BOM; an
   ASCII cookie cannot reinterpret plain ASCII bytes as UTF-16 without structural
   evidence of that encoding.
5. Validate UTF-8. Plain ASCII defaults to UTF-8 with low confidence and legacy
   alternatives, because those bytes do not identify their original charset.
6. Feed up to 64 KiB into chardetng, moving to the first non-ASCII evidence when
   the initial sample is entirely ASCII. Rank all syntactically valid supported legacy
   candidates using that statistical prior, control/letter/script coherence,
   Latin alphabet repertoire coherence, mojibake/case penalties, a Euro-currency
   tie-breaker and Vietnamese combining-tone evidence. Include
   OEM/ISO candidates that the browser detector does not directly identify.
7. Return a conservative evidence score and alternatives. Decode the complete
   buffer strictly with the selected codec; invalid sequences return an error.

Confidence is an evidence-strength indicator, not a calibrated probability.
Byte-identical subsets (for example GB2312/GBK and Latin-1/Windows-1252), short
snippets, BOM-less UTF-16 with little ASCII structure, and language mixtures can
remain ambiguous. Explicit selection or a declaration resolves those cases.
Each file diff has one compact File encoding selector, defaulting to Automatic.
It applies the chosen codec to the file preview, with no per-side controls or save
flow. Choices are kept separately per repository/path for the current window session;
Automatic restores the original auto-detected diff. MR and commit previews share the
selector and reject late responses after file/ref/encoding changes. The selection
changes viewing only; it does not rewrite file bytes or change AI review policy.
Auto-detection does not promise recovery of the original label for every possible
byte string.

## Integration and resource contracts

- Git metadata remains separate from file bytes. `git/text_content.rs` reads bounded
  immutable blobs without lazy fetching or invoking textconv/external diff drivers.
  Git paths use shared C-style quoting, including control characters and UTF-8.
  `get_file_text_diff` is the explicit read-only preview IPC, bounded to 8 MiB per
  regular source blob and 5 MiB for the decoded patch; its metadata read forbids
  lazy fetching and external diff/textconv execution.
- MR and commit diffs retain native UTF-8 sections. Encoded sections are regenerated
  from decoded source snapshots, independently for each side/file. UTF-16 text no
  longer inherits Git's NUL-based binary classification. Original mode/rename/object
  metadata remains visible even when decoded text is identical. Preview normalization
  reads at most 8 MiB per blob and 64 MiB in total, retains the 5 MiB patch ceiling,
  and marks incomplete commit previews as truncated. Oversized/unreadable candidates
  retain the native fallback with a limit notice; actual binary files remain binary.
- Blame replaces source content without transcoding author/commit metadata. UTF-16
  byte-line coordinates are mapped back to decoded lines, including false LF bytes
  inside code units. A decoded line spanning multiple Git byte lines uses the first
  byte-line attribution. Original coordinates are resolved against bounded historical
  blobs; unavailable originals fail instead of inventing coordinates.
- Conflict previews decode on-disk and immutable side content before counting markers
  and merging. A temporary decoded three-way merge provides Unicode marker regions.
  The source worktree/index/refs are never rewritten.
- Review source blobs retain the 256 KiB raw-object limit, immutable IDs, regular-file
  checks and full-blob secret filtering. Encoded source patches retain the 512 KiB
  diff cap and existing evidence, coverage, pagination and egress checks. Native Git
  grep still performs byte-oriented literal matching; returned source lines are
  decoded and redacted from the complete blob, not decoded grep fragments.
  UTF-16 conversion also checks the original raw representation for ASCII secret
  blocks and fails closed if conversion would obscure an egress restriction.
- Sandbox range paging uses `TextReader`, sampling at most 64 KiB and streaming through
  a stateful decoder with bounded buffers. ASCII-only prefixes defer the final legacy
  choice until non-ASCII evidence appears. Raw scan and decoded-output limits remain
  enforced; UTF-8 truncation stops on a complete codepoint. BOMs, multibyte characters
  and UTF-16 surrogate pairs work across sample/chunk boundaries.
- Temporary decoded diff/merge files live in a private `tempfile` directory, are used
  by bounded Git subprocesses, and are removed on drop. The files are preview inputs;
  no source content is included in diagnostic errors.

## Verification

`backend/test-data/text-encodings/corpus.json` contains independent reference bytes
and expected Unicode strings for all 40 catalog entries, produced with Python's
standard codecs. Rust tests verify exact explicit conversion, streamed declared/BOM
conversion, automatic Unicode recovery on the curated legacy samples (not a universal
detection guarantee), malformed sequences, C1 controls, GB2312 punctuation, ambiguity reporting,
multibyte boundaries, large ASCII prefixes and scan limits. Real Git fixtures exercise
mixed-encoding branch/commit diffs, UTF-16 blame and conflict previews, quoted paths,
truncation, unchanged source files/refs, and review redaction/coverage.

Primary codec references: [encoding_rs](https://docs.rs/encoding_rs/latest/encoding_rs/),
[chardetng](https://docs.rs/chardetng/0.1.17/chardetng/),
[oem_cp](https://docs.rs/oem_cp/2.1.2/oem_cp/), and the
[WHATWG Encoding Standard](https://encoding.spec.whatwg.org/).
