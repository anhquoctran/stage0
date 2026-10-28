# Review input trust and prompt injection

Stage0 uses one reviewer model. Security screening adds no inference requests,
classifier service, model download or dependency. It is advisory; permissions,
snapshot reads, evidence checks and publication remain Rust responsibilities.

## Trust boundaries

- Stage0's role catalog, review workflow, tool definitions and fixed policy own
  the privileged system message. User-configured text never enters that message.
- `reviewPreferences` is a JSON field in the initial user context, identified as
  `local_reviewer_preferences` with `review_preferences_only` authority. It can
  guide focus, language and presentation, not disable security/correctness,
  coverage, source policy or evidence checks. Native protocols preserve their
  real system/user separation. ACP carries the same separated envelope as text;
  JSON role fields are not a protocol-enforced instruction hierarchy.
- Repository text, names, discussion bodies and peer AI comments remain review
  context. A legitimate request to explain or reassess code is supported within
  the current scope. Claims of admin/system authority and mentions grant no
  capability. Imported/repository instructions must not be promoted to policy.

JSON encoding prevents data from changing envelope syntax; it does not prove
that a model will ignore a malicious natural-language instruction.

## Grouped source delivery

Full MR runs receive an initial `diffBatch` in the user context. It contains
filtered diffs from the captured Git objects, never current checkout contents.
All files that fit are delivered together. Larger changes use `get_diff_batch`
with an explicit `{fileOffset, diffOffset}` continuation cursor. Files are kept
whole where possible and grouped by neighboring repository paths; a large file
can span packets with its diff-line offsets and base/head source counters.
The bounded manifest exposes `nextOffset` when more path names remain. Per-file
read failures are explicit and never count as complete coverage.

Both delivery paths share full-blob secret screening, including private-key
blocks that begin outside the displayed hunk. Cached sanitized diffs have an
estimated 2 MiB memory cap. Every packet retains the untrusted-data authority;
repository instructions cannot enter system prompts or expand capabilities.
The initial source packet is bounded by 64 KiB, configured output limits and the
remaining context budget with 32 KiB reserved for later investigation. Its
encoded adapter request is measured and reduced to reserve follow-up turns
under the existing wire budget. Tool batches retain the 24 KiB result cap and
respect the configured line/output limits. Total delivered context, cumulative
wire bytes, reported tokens, tool calls, cancellation and deadlines remain bounded.

Preparing/caching source grants no coverage. Initial delivery is committed only
after a successful provider response, before processing its tool calls. Rejected
or unsent packets grant no coverage; later batches must connect to the contiguous
delivered prefix of each diff. The complete eligible-diff gate still controls
description generation and approval. Description and review reuse one history
or ACP session, so supplied diffs need not be fetched again. Cross-file analysis
and findings are allowed within the same turn; evidence checks still apply to
every finding. Thread-scoped replies neither preload bulk source nor expose the
batch tool.

## Discussion reply workflow

Ordinary user-created discussions and replies enqueue
`queueAssignedDiscussionReply`, not a full MR batch. A per-session queue waits
for existing reviews/batches, coalesces repeated requests for a thread and
refreshes context between reviewers. Exact direct mentions route replies;
quoted/code mentions do not. Without an explicit recipient, the original
assigned bot is preferred. Backend checks remain authoritative and require a
currently assigned, eligible reviewer.

The exact root body `[@Assigned reviewer](#mr-mention/reviewer/<encoded-id>) review`
is a separate host workflow. The frontend recognizes the editor-generated
Markdown mention, checks that bot's unresolved code discussions and starts one
full run for that bot only. The runtime prompt treats this as normal full-review
intent; it grants no extra authority. Backend reply eligibility marks the exact
command as host-managed so model-generated reply actions cannot race with the
host's progress and completion replies. Other discussion bodies retain the
scoped reply workflow.

`replyDiscussionId` is an optional, additive request/run field. Older records
default to full-review scope. A reply run exposes only:

- `list_open_discussions`, restricted to its one thread;
- `read_discussion_comment`, restricted to that thread;
- `get_file_diff` and `read_file_range`, restricted to its anchored file;
- `reply_to_discussion`, restricted to that thread;
- `submit_review`, with only `comment` and zero findings.

The registry, dispatch/submission checks and publication transaction enforce the
scope independently. No description generation, new findings, resolutions, MR
approval, other-thread actions or reviewer/MR status updates are authorized.
Completion requires a queued reply. `completed` here means a completed discussion
reply, not full MR coverage; the UI identifies it explicitly. Git-change and
explicit full-review workflows retain the complete review tool set and guards.

Reply budgets are 16 turns, 24 tool calls, 32 KiB delivered context, 384 KiB
cumulative reserved request bytes and 32,000 reported tokens. The existing
request/output caps, cancellation and deadline also apply. Reported usage and
wire bytes are bounds, not an exact tokenizer or guaranteed monetary ceiling.
Successful repeated replies are deduplicated by a bounded cache of comment
ID/time/body SHA-256 hashes. Hashing failure disables caching. Failed runs are
not cached as successful answers.

## Context delivery and stale writes

`list_open_discussions` returns at most two threads per page, always retaining the
root finding plus the latest five comments without duplicating the root. Each
body preview has at most 200 Unicode characters. `nextBodyOffset` explicitly
marks truncation; `read_discussion_comment` returns up to 1,200 characters and
allows older comments to be requested too. Bodies retain original content except
the existing secret redaction. Returned data includes source/authority metadata.

The host tracks contiguous delivered coverage of the root and latest comment.
Reading a tail first, an oversized/rejected output or model-supplied claims of
coverage cannot authorize an action. Discussion outputs consume the same guardrail
and total context budgets as source tools.

Actions require `targetCommentId` and `discussionRevision` copied from delivered
context. The SHA-256 revision includes the thread's session, anchor, original
commit, resolved state, and all ordered comments' IDs, authors, bodies, review
actions and timestamps. It detects same-ID edits even if timestamps are unchanged.
Dispatch rejects a changed revision or unread root/latest body. Publication
recomputes the revision inside its existing SQLite transaction, then rechecks
latest ID and reply eligibility. A stale action rolls back publication.

## Resolution and output

Normal AI resolutions require exact current-head evidence and a file blob that
differs from the original finding's commit. Base-side quotes, unchanged files,
missing original snapshots and verbal claims of a fix cannot resolve a thread.
The separate exact-revert check still compares original/head/base blobs. Normal
changed-line and source-redaction requirements remain in place. These checks are
necessary conditions; they cannot prove a semantic bug was fixed. Uncertain fixes
and disputed false positives stay open for a user's explicit manual resolution,
which retains `manual` attribution rather than `ai_verified`.

Outputs retain secret redaction and the existing Markdown sanitizer/CSP, including
blocked automatic remote images. Model output never becomes executable code or
new tool definitions.

## Advisory signals and audit

`input_screen.rs` checks a bounded, case/whitespace-folded copy for known override
phrases, role markers and invisible/directional characters. It neither rewrites
source nor rejects security examples. The original text remains intact apart
from existing secret redaction. This is not comprehensive Unicode normalization,
an intent classifier or a security boundary; unflagged inputs can be malicious.

Events record preference bytes/scope, signal categories, delivered comment IDs
and thread revisions, output signal categories and existing tool outcomes.
Raw preferences, comment bodies, source, tool arguments, secrets and model
reasoning are not added to audit logs. A signal can also mean a benign quoted
attack; it never grants or revokes tool authority.

## ACP limitations

ACP receives the same scoped tool definitions, policy, redacted input, output
schema validation, budgets and publication guards. Workspace requests from ACP
are denied and review sessions use temporary working directories with no MCP
servers. An external agent remains a trusted installed program: its own local
tools, inherited environment and OS/network access are not confined by changing
its working directory or rejecting client-side requests. Existing UI disclosures
state this limitation. These changes do not claim an OS sandbox for ACP.

## Verification

Rust fixtures cover protocol-level preference separation, native HTTP and ACP
codec attacks, unauthorized tools/verdicts, cross-thread/file access, unread and
truncated context, same-ID edits, transactional stale-write rejection, unchanged
head/base evidence, valid fixes and exact reverts. Node tests cover recipient
routing, thread-only scheduling/cache and unchanged frontend MR verdict/description
state. Fixtures use no real model accounts or paid inference. They verify host
boundaries, not a model's resistance to every semantic attack. Real-model quality
and adversarial evaluation remain separate deployment checks.

References: [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html),
[OpenAI](https://developers.openai.com/api/docs/guides/agent-builder-safety),
[Anthropic](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks),
[CaMeL](https://arxiv.org/abs/2503.18813).
