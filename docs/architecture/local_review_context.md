# Local review context

The optional AI Preferences setting `ai.aiConfig.localReviewContext` defaults to
false and follows the existing Apply/OK/Cancel transaction. When enabled, every
provider and ACP shares the same local source cache and compact prompt. Native adapters additionally share
context-delivery references; ACP keeps complete tool outputs because an external
agent may compact its own history without notifying Stage0. It does not cache/replay model responses, verdicts, replies,
resolutions or publication. The legacy prompt and uncached path remain available.

## Storage and ownership

Each canonical repository path hashes to a directory under
`app_cache_dir()/review-context/repositories/<hash>/context.db`. Nothing is
written to `.stage0` or the main `stage0.db`. SQLite WAL may create `-wal` and
`-shm` sidecars. Connections are operation-scoped and use WAL, synchronous FULL,
short busy timeouts, trusted_schema OFF and private user permissions. Static
sqlite-vec initialization never enables loading arbitrary native extensions.

Exact read keys bind snapshot SHAs, literal path/side and the captured guardrail
policy with a decoder/redaction/output format version. Cached blobs are already
redacted; diff records retain their original redaction flag and coordinates.
Exact records use HMAC-SHA256 authenticated with a random process-only key. A new
process revalidates exact reads from Git before refreshing their authentication;
no integrity secret is persisted or fetched from a credential vault. Vector hints
remain rebuildable and are reread from Git. Evidence and revert validation always
read Git directly; a modified cache cannot authenticate a fabricated source read.
Current path/read/output guards are rechecked before delivering cached data.
Repository read gates coalesce concurrent cache misses without sharing a run's
coverage or authorization. Cached data and optional vector hints are untrusted.

Vector rows, reusable content-hash embeddings and chunk coordinates are inserted in one transaction. Identical sanitized chunks reuse embeddings across snapshots within the same repository/model namespace. Queries
filter exact snapshot and model identity *inside* the KNN search. The index is
partial: only previously read/sanitized blobs are submitted, the bounded queue
may drop work, and oversized lines/chunks are omitted. Missing matches never
prove absence; literal search and source-range reads remain available. The
optional `search_related_context` tool appears only in full-review registries
whose model is ready at run startup; reply-only capabilities stay unchanged.
Every hit is reread from immutable Git under current guards before delivery.

The cache retains at most four repository databases (128 MiB page limit each,
plus bounded WAL), 128 exact entries per database and 20,000 vector rows per
repository. Evicting an old repository or clearing all repository caches advances
an epoch before removal. Connections are closed first, including on Windows;
stale handles and queued workers cannot repopulate the cleared generation. Model
files are preserved by the separate, explicitly labelled repository-cache clear.
Cache errors fall back to normal reads; source/evidence errors remain errors.

## Embedding runtime

The application statically compiles sqlite-vec 0.1.9. CPU inference uses Candle
0.11.1 and tokenizers 0.23.2, without an ONNX DLL, GPU backend or runtime binary
download. These are pinned candidates that must pass the native target matrix.

The explicit Download button installs `intfloat/multilingual-e5-small` from
immutable revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`. Config, tokenizer
and safetensors have pinned lengths/SHA-256 values (487,724,985 bytes combined,
about 465 MiB). No source, API key or provider credential accompanies downloads.
Incomplete files never receive a ready marker. Temporary files, size bounds,
checksums and atomic publication protect installation. Loaded model inputs use
query/passage prefixes, mean pooling and L2 normalization; inputs above 512 tokens
are rejected, never silently truncated. No repository-defined code is executed.

One process-wide model lock serializes inference; the background queue holds
at most eight sanitized blobs. Indexing takes at most eight chunks per blob,
checks clear/cancellation generation between chunks, and stops after a soft
three-second budget between inference calls. A single inference and initial
model loading cannot be preempted; CPU/RAM and release-mode latency must be
measured on supported hardware. Busy/missing embedding workers return explicit
fallback hints instead of marking the review failed or complete. An activity
lease prevents software installation during owned background work/downloads.

## Context and prompt behavior

For native providers, a large identical tool result may be replaced by a reference only after the
original result passed output limits in this same conversation. References do
not transfer between runs. No history compaction currently removes referenced
content; adding compaction later must invalidate the delivery ledger. Changes
to coverage tracking remain independent of these references.

The opt-in compact prompt removes repeated instructions, retains scope,
injection boundaries, direct-mention rules, resolution proof and approval guards,
and avoids resubmitting findings already queued. It uses the same provider wire
adapters and source-consent checks. The original prompt remains the default
until live-model quality evaluation justifies wider rollout.

A `local_context_cache` run event reports exact read/hit counts and bytes avoided
by duplicate delivery references. These are local byte counters, not provider
billing savings. A controlled native-codec fixture compares the same three tool
turns with/without optimization. It verifies smaller serialized requests and
unchanged partial coverage; it is not an LLM quality benchmark.

## Verification and rollout

Protected cases cover transactional vector rollback, snapshot/policy isolation,
corruption, symlink rejection, stale worker invalidation, uncached evidence,
redaction, rejected/unobserved delivery, missing-model fallback and actual native
tool-loop behavior. Normal CI does not download model weights or call paid APIs.
Setting `STAGE0_EMBEDDING_TEST_MODEL` to a verified model directory adds a real
CPU-model smoke check to the normalization test; baseline assertions always run.

Before enabling by default, compare repeated runs on fixed snapshots per provider
and model: finding precision/recall, critical/security misses, cross-file issues,
false positives, evidence, incomplete coverage, token breakdown/cache hits,
turns, latency and local resource consumption. Preserve all original regression
contracts. macOS checks do not establish Windows/Linux or ARM64 package support;
release certification must execute all six native targets.
