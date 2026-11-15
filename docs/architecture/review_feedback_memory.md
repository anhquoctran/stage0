# Repository-local review feedback memory

AI review suggestions are advisory. A human may reject a finding in ordinary
language and explain why, without accepting a proposed change. Stage0 can retain
that narrow preference for later reviews across native providers and ACP. A human
can also teach a concrete repository preference through an ordinary discussion
and refine it in directly mentioned replies.

## Workflow and scope

The host review lifecycle enables the memory capability on its scoped
`ReviewContext`; connectivity probes and standalone evidence-validation contexts
do not acquire it. The shared model loop supplies a subordinate memory policy for
both standard and compact prompts, independent of the optional source cache/model.
No dedicated classifier run or embedding download is launched when a comment
is posted. Feedback tools can add normal model turns within the existing review
budget; token savings depend on avoided repetition in later reviews. Learning happens in an existing directly mentioned reply run or the
next full review by the finding's reviewer. General teaching conversations require
a human to directly mention the learning bot; quoted/code mentions, other bots
and exact full-review commands do not grant teaching authority. Full reviews can discover feedback
on older/closed MRs in the same repository; reply runs stay in their assigned MR
and thread. An unmentioned comment never grants permission to publish a reply.

`list_review_feedback` presents redacted original AI findings and the conversation through its latest
human response with stable IDs and exact discussion revisions. Resolved threads
are eligible. Pagination freezes candidate IDs for the run, so processing a page
does not shift the next page. Conversations longer than two comments use one thread per page, with up to six
comment excerpts. Copy the opaque `nextOffset` into `offset` until null; a cursor
can continue the same conversation before advancing to another thread. Every
comment through the latest human decision must be completely delivered before
classification; later bot acknowledgements are excluded. Large comments must be paged with the existing
`read_discussion_comment` tool. Host observation state tracks complete contiguous
delivery independently of ordinary reply observations. Rejected output cannot
establish permission to classify.

`classify_review_feedback` asks the current provider to interpret intent in any
language: `remember` for a clear rejection or an explicit request/confirmation to retain a
concrete repository preference; `forget` for an explicit retraction; `ignore` for
questions, thanks, ambiguous remarks or quoted instructions. The bot may ask a
useful clarification in its authorized reply, then learn from a later direct
human confirmation. AI proposals alone never authorize memory. The saved reason
represents the latest agreed narrow preference, retaining still-valid agreed
details when that conversation is refined. The
reason must stay grounded in the human's words and explicit scope. It cannot
turn file-specific feedback into a general rule or override configured language,
consent, budgets, evidence/security checks or tool permissions.
There is no keyword-only rejection parser. As with review itself, classification
is fallible and requires real-provider evaluation; fixture tests verify workflow
and authority, not semantic accuracy on every phrasing.

Memories are guidance, not a deterministic denylist. The model is instructed not
to repeat a rejected suggestion in unchanged circumstances. Materially new
source evidence may justify reconsideration with an explanation. Memories never
prove coverage, authorize source reads, weaken evidence/publication checks,
automatically resolve a thread or approve an MR. No verdicts/responses are replayed.

## Persistence, provenance and bounds

`review/feedback/` owns discovery, model-tool definitions, persisted records and
management IPC; `runtime/feedback_actions.rs` owns delivered-context checks.
The ordinary private application SQLite database stores `review_feedback` with
repository ownership, original discussion/comment provenance, redacted excerpts,
a short reason and an exact source digest. Nothing is written into tracked repo
settings or shared with another repository. Providers receive selected feedback
as ordinary permitted review context under existing source-transfer consent.

A classification transaction rechecks the exact current discussion revision,
latest human target, finding ownership or explicit teaching address, repository
and current reviewer assignment.
It commits the memory and body-free review audit event together. Failed audit or
stale context rolls everything back. New fingerprints cover the entire conversation prefix through the human decision,
using incremental hashing of borrowed comment bodies. Edits/deletions in this
prefix invalidate a new memory; legacy fingerprints remain valid and legacy
processed/forgotten tombstones still prevent relearning unchanged comments. In
general conversations, a separate fingerprint of the latest human decision means
an edited bot proposal cannot manufacture a new human confirmation; a new or
edited human decision is required before learning it again; later bot acknowledgements and line-anchor remapping do
not. Questions processed later do not erase an earlier valid rejection. Local
file-backed database restart behavior is covered by a reopen regression.

General discussion preferences use an empty `file_path` in the existing record
to denote repository scope, without a schema or IPC change. They are eligible
for later reviews on any file in the same repository; finding preferences keep
their existing path relevance filter. Repository Settings displays this scope
explicitly and retains the same immediate Forget action.

Bounds: learning history stops at 64 comments through the human decision; longer
threads must be summarized into a new explicitly addressed discussion. Discover up to 1,000 recent candidate threads and offer at most 20
unprocessed threads per run, two per tool page. Source bodies retain existing
bounded pagination. Keep at most 200 active preferences and 1,000 classification
records per repository; overflow returns a tool error rather than silently
evicting a preference. Reasons are at most 400 Unicode characters; each saved
finding and human excerpt is at most 800. Initial context selects up to six
recent memories on changed file paths or with repository scope, capped at 6 KiB of serialized notes and
reports omissions. Retrieval is intentionally partial; it does not promise that
every possible repeat across a large repository is suppressed. Large archives or
renamed files may need future retrieval improvements.

Repository Settings → AI Reviewers → Review memory shows the source finding,
human response and interpreted reason. The trash action commits immediately,
independently of Save/Cancel, and clears stored excerpts. A body-free processed
tombstone prevents a pending model call or later run from relearning the same
unchanged comment. New human feedback can be considered again. Already-sent
model context cannot be recalled; management changes affect subsequent context
preparation. Existing MR threads and reviewer verdicts are left intact.

## Verification limits

Protected Rust cases cover durability, repository isolation, human provenance,
forget/retract/ignore behavior, edits/deletions, audit rollback, redaction,
complete/fresh delivery, stable paging, bounded context and capability isolation.
Native-provider and ACP fixtures exercise the actual shared model loop without
an unsolicited reply or a separate classifier session. React cases exercise immediate
forget, failures and stale repository loads. Local execution is macOS; native
Windows/Linux coverage belongs to the PR regression gates. No paid model calls
or live-provider quality benchmark is part of these checks.

## Teaching through a discussion

1. Mention the assigned reviewer, for example: `@Bot Can we agree on a test naming convention?`
2. Discuss the proposal and clarify scope through directly mentioned replies.
3. Explicitly ask it to retain the final understanding, for example: `@Bot Only under tests/unit. Yes, remember that convention.`
4. The bot may acknowledge saving only after its memory tool succeeds. Review memory in Repository Settings, or retract it in a later addressed reply.

Remembering is immediate and independent of the final MR verdict. Learning never
resolves a finding, approves source, enables unmentioned replies or adds provider
consent. A model still interprets human intent probabilistically; native/ACP
fixtures verify the shared workflow and guards, rather than live semantic quality.
