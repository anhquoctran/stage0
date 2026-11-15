# Bounded review continuations

A November 14 DeepSeek run stopped at 65,406 cumulative reported tokens after
five requests. Its ten eligible file diffs had already been delivered in the
first request (14,142 context bytes), but six open discussions required three
separate two-thread pages. Stateless replay grew the wire payload from roughly
35 KB to 66 KB. These numbers were read from existing run/event metadata only;
no source, credentials, prompts or model reasoning were exported.

## Discussion batching

`runtime/discussions.rs` packs up to eight threads per response rather than
assuming two. It measures the entire serialized response against a soft 16 KiB
page target and the smaller remaining context/configured output allowance.
The existing 24 KiB external-output hard cap remains authoritative. A single
oversized entry still fails through the existing output gate rather than being
silently dropped or granting observation rights. `nextOffset` advances only by
accepted entries. Callers must follow the returned cursor, not a fixed page size.

Comment excerpts remain 200 Unicode characters, with the same root/recent-history
selection, exact revision, target IDs and explicit continuation offsets. Full
body paging, direct-mention permission, scoped reply mode, redaction, source
consent and read-before-action/publication checks are unchanged. Only successfully
delivered pages contribute observation state.

## Input reservation and finalization

`provider/usage.rs` reads optional native-provider input counts. DeepSeek/Qwen/Kimi
use `prompt_tokens`, OpenAI uses `input_tokens`, Gemini uses `promptTokenCount`
and Ollama uses `prompt_eval_count`. Anthropic's separate cache creation/read
input counts are included in the observed input footprint. Cache hits already
inside a provider's prompt count are never added twice. This planner does not
change the existing decoder's total-usage accounting.

`runtime/request_budget.rs` observes input tokens and encoded request size after
a response. Its next-input estimate includes the observed input plus added bytes
and a framing margin; when the request shrinks, it scales the observation by the
size ratio. This is an estimate, not a tokenizer or a provider billing guarantee.
The next output allowance reserves that input first. Providers/adapters without
separate input usage retain the existing total-token/wire controls; ACP retains
its existing stateful continuation and accounting behavior.

For full reviews, when the remaining budget cannot comfortably fund another investigation turn
and final output, and any required description update has completed, the host switches to a submit-only tool set and adds a bounded
finalization instruction. Runtime action scope independently rejects other tool
calls even if the model requests one anyway. The model can submit supported
findings and explicit limitations; it cannot bypass evidence, coverage, revision,
assignment, unresolved-discussion or approval checks. Queued actions remain staged
until the ordinary guarded submission. Reply-only runs retain their reply tools
and normal read/reply/submit flow, with input reservation and preflight stopping
still active; they are never forced into a misleading silent no-reply completion.
No model response is cached or replayed.

If estimated input alone consumes the remaining budget, stop before another
request and record `requestSent: false`; the localized message distinguishes
this reservation failure from an actual measured overrun. Truncated output is
still discarded completely. Its one permitted expansion retry is allowed only
when the reserved-input output allowance can actually grow.

The full/reply hard token limits remain 64,000/32,000. Deadlines, turn/tool-call
limits, per-request and cumulative wire budgets, failed-response handling and
post-response checks remain authoritative. DeepSeek reasoning history and Gemini
thought signatures are never trimmed. See the official [DeepSeek thinking/tool
continuation contract](https://api-docs.deepseek.com/guides/thinking_mode/).

Body-free events `model_input_usage`, `request_budget_planned`,
`budget_finalization` and `budget_exhausted` provide observed input, estimated
input, output allowance and reservation details without retaining raw prompts,
source, tool arguments or model reasoning.

## Verification and limits

Protected behavior cases exercise a ten-file/six-discussion fixture through the
real DeepSeek wire codec and shared runtime: the mock model follows returned
page cursors and finishes in two requests under 64,000 synthetic reported tokens.
Other cases cover Unicode byte bounds, contiguous pagination, configured/context
limits, incomplete/rejected delivery, mention scope, input reservation, preserved
reasoning, unaffordable-input refusal, unchanged approval guards and a truncated
final response that cannot afford a larger retry. Input usage shapes are covered
for all seven native provider families. Existing budget, provider, evidence and
injection regressions remain intact.

This validates orchestration, not live-model semantic quality or exact provider
cost. No paid model calls are made by these tests. A real model may need more
investigation than fits the bounded budget; such a run must still be incomplete
or report limited coverage rather than claim an unsupported approval. Local
execution is macOS; PR CI owns Windows/Linux native coverage.


## Follow-up: prevent output starvation during required description generation

A later real run stopped at 61,675 tokens because its fourth request was given
only 504 output tokens. The preceding request had 18,080 observed input tokens
and 66,445 encoded bytes; the next planning preview was 69,031 bytes and had
21,426 tokens remaining. Conservative input reservation left 504 for thinking
and the tool response. Description generation was still pending, preventing the
normal submit-only finalization transition. This was a controller starvation
bug rather than proof that the provider's configured output limit was too small.

`runtime/description_phase.rs` now owns a bounded inventory → description → review
workflow. Complete initial source delivery selects only `update_mr_description`
for the first model turn; partial packets expose the inventory/diff tools until
actual coverage is complete. The projected initial packet affects tool selection
only: coverage is still committed after successful delivery, and metadata writes
still revalidate actual coverage and concurrent edits. Each phase transition adds
one host instruction. Once the description is saved, the full review tool set
returns and already delivered source/reasoning remains intact. Early discussion
mutations are independently rejected while a required description is pending.

The adapter contract adds an optional minimum output allowance. Native DeepSeek
thinking uses a local planning floor of 4,096 tokens, within its existing 16,384
initial output ceiling; this is a Stage0 safety margin, not a claimed provider
minimum or a quality guarantee. Requests with observed input that cannot leave
this headroom stop before another paid call, using the existing incomplete-budget
classification and an explicit output-headroom explanation. Thinking is never
automatically disabled and the 64,000 total limit is unchanged.

Four additional protected cases replay the 504-token planning calculation without
user source, verify a complete ten-file description-first workflow, prove that
projected source cannot authorize an early write, and check native thinking/none
adapter behavior. The protocol/usage fixture validates orchestration only; no
live provider request or user quota is consumed by these tests.
