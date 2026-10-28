# Snapshot-based AI review harness

## Scope and use

To request a manual review, start a new Virtual MR discussion, mention one assigned reviewer, and add `review` after the mention. Stage0 checks that reviewer's unresolved findings before starting a single full review. Remote review sends eligible tracked source to the configured provider; ACP source transfer must be enabled in that reviewer profile. Validated findings and queued discussion actions publish when `submit_review` succeeds. Closing the panel or choosing **Run in background** does not cancel the task; use the status-bar activity button to return, or **Cancel review** to stop it.

This is a native Tauri feature. A browser-only development session cannot access the Rust runtime or OS credential store. The panel can run using global AI preferences or an assigned reviewer profile. A profile supplies subordinate review preferences and, when explicitly configured, provider, model, reasoning effort and Fast mode. Profiles run one at a time per Virtual MR. Git-change automation uses full reviews; user discussion comments enqueue scoped replies. See [review input trust and prompt injection](review_prompt_injection.md) for the current capabilities, delivery/version checks and ACP limitations.

Stage0's review tools cannot run terminal commands, install dependencies, write patches, start MCP servers or merge on remote Git hosts. Full reviews can update local descriptions, publish findings/replies, resolve with current-head fix evidence and record a guarded local verdict. Reply-only runs can answer one thread and cannot resolve or decide an MR verdict. The harness cannot assess uncommitted working-tree changes, execute tests or claim test results. A completed run or zero findings is not a proof of safety. ACP agents remain external trusted processes, not OS-sandboxed programs.

## Implementation and data flow

1. `frontend/features/review` sends session ID, provider configuration, optional assigned reviewer identity, declared model-specific reasoning effort/Fast mode settings and consent, never plaintext API keys or client-selected repository refs. A profile inheriting the global model resolves against the current global configuration.
2. `backend/src/features/review/commands.rs` loads the session/repository from SQLite, resolves base/head OIDs once, calculates the merge-base and captures the effective guardrail policy. The review diff is merge-base → head (three-dot semantics).
3. The coordinator admits at most two concurrent runs and one per session. A unique partial SQLite index independently prevents duplicate active runs for a session.
4. The Rust background worker calls the provider, validates scoped tool names/arguments, executes snapshot reads and stages permitted local discussion actions until `submit_review` or a limit/error ends the run. Native reasoning/signature items stay in the in-memory conversation and are replayed when required; they are not persisted in traces.
5. Structured findings must reference an eligible changed path, a valid base/head line range, and an exact non-redacted quote from that immutable Git blob. This validates coordinates/evidence, not the model's interpretation of a bug.
6. SQLite stores run history, snapshot OIDs, provider/model/endpoint, optional reviewer identity, a prompt/policy fingerprint, counters, findings and event metadata. Raw source, tool arguments and model reasoning are not recorded in events. Findings and summaries can contain source excerpts and are retained locally with MR data.
7. Publication inserts deterministic discussion/comment IDs in one transaction and rechecks pending actions' thread revisions and reply eligibility. The explicit publish IPC also checks current refs against the snapshot. Findings create open threads; verified resolution actions can close existing ones. A full review's guarded local verdict may update assigned reviewer/MR status; reply-only runs cannot. Repeated explicit publication does not duplicate findings.

The frontend guards stale history and polling responses when sessions/repositories change. Backend tasks survive panel closure, not application exit. On startup, persisted `running` records become `interrupted`; there is no implicit request replay or crash resume. History currently exposes the latest ten runs per session; no automated retention/deletion policy is configured.

## Available tools

| Tool | Contract |
| --- | --- |
| `get_diff` | Snapshot identity and inventory counts; never a raw repository-wide diff. |
| `list_changed_files` | Eligible paths, 100 per page. |
| `get_file_diff` | One eligible path, 100 diff lines per page, fixed OIDs, filtered content. |
| `read_file_range` | Up to 200 numbered lines on the merge-base or head side. |
| `search_code` | Literal query of 3–120 characters against head; at most 50 filtered matches. |
| `list_directory` | Regular tracked files under a head-tree prefix, 100 per page. |
| `submit_review` | English summary and at most 50 findings with path, side, range, severity, title, body and exact evidence. Must be the only call in its final turn. |
| `list_open_discussions` | Two threads per page; includes original finding and recent comments, explicit truncation, target ID and revision. Reply runs see their assigned thread only. |
| `read_discussion_comment` | Bounded Unicode-character pages of a comment at the observed revision; root and latest bodies must be fully delivered before actions. |
| `create_review_discussion` | Full review only; queue an evidence-backed changed-line finding. |
| `reply_to_discussion` | Queue a reply to the eligible latest comment actually read; require matching target ID/revision at dispatch and transactional publication. |
| `resolve_discussion` | Full review only; current-head evidence after a change since the original finding, or independently verified exact revert. |

Schemas are closed objects with required fields and bounded values; the backend validates them independently of provider enforcement. Unknown tools and invalid arguments produce explicit error results, never host execution. Repository content is untrusted data and cannot grant additional tools or override policy.

## Source and secret boundaries

- Reads use Git blob/tree objects at captured OIDs, independent of the selected sandbox and physical checkout. No ref switches, Git index writes or working-tree writes are needed.
- Reads disable replacement objects, optional locks, fsmonitor hooks, lazy fetch and every remote transport. Missing partial-clone objects fail closed; fetch them explicitly outside a review. Color, custom diff indicators and hunk-header source context cannot bypass filtering. The user-selected Git executable and local Git installation remain trusted dependencies, not an OS sandbox.
- Absolute/traversal/control-character paths, symlinks, submodules, sensitive path patterns, binary blobs and oversized objects are blocked. Deleted regular files can be read on the base side. Submodule content and arbitrary host files are not traversed.
- Mandatory sensitive-path checks cannot be turned off by mutable user guardrails. User guardrails may restrict access further.
- Snapshot inventory and repeated Git path validation consult sensitive-path rules without consuming sandbox read-call rate limits. Review tool/context budgets are enforced by the review runtime, so a large tree cannot exhaust a per-minute counter and incorrectly exclude ordinary source files.
- Complete blobs are filtered before search snippets or partial diff hunks are exposed, including private-key interior lines and Git hunk-header function context. Matching credential-like lines are redacted. This deliberately conservative heuristic can hide legitimate source, and cannot recognize every secret.
- Diff coverage becomes partial after exclusions, redaction, tool errors, or unread diff pages. A model may still submit useful findings with incomplete coverage, clearly labelled `partial`.
- Remote providers require explicit consent and HTTPS. HTTP is allowed only on loopback. Official provider keys are confined to their official endpoints; arbitrary endpoints use the separately configured Custom key. Redirects, embedded credentials, query strings and URL fragments are rejected. Ollama is restricted to loopback.
- Findings render as escaped text in the run panel. Published discussion Markdown continues to use the existing preview rules, including blocked remote images.

The existing MCP settings still store environment values in ordinary local preferences and configuration exports. Do not put secrets in those fields. Local configuration checks do not claim successful handshakes. A separate explicit connector panel now supports source-free Streamable HTTP discovery and CLI filesystem preflight; discovered tools are not connected to review runs. Secret binding/OAuth, external-tool execution, stdio launch, approval-gated CLI execution and sandbox test runners require separate work. See [external connector preparation](external_harness_connectors.md).

## Provider protocols

| Provider | Native protocol | Authentication |
| --- | --- | --- |
| OpenAI | Non-streaming Responses with strict function schemas, required tool choice, `store: false`, correlated `function_call_output` and in-memory reasoning continuation. | API key from OS keyring, official endpoint only |
| Anthropic | Messages `tool_use` / `tool_result`; required `any` choice only for models known to support it, otherwise `auto` plus bounded recovery; original content/signatures retained | OS-stored API key, official endpoint only |
| Gemini | generateContent JSON Schema declarations with function-calling mode `ANY`; native content/thought signatures and matching function IDs retained | OS-stored API key, official endpoint only |
| Ollama | `/api/chat`, non-streaming native tool calls/results; no API-level forced-choice field, so prompt, response validation and one bounded recovery are used | Local loopback daemon |
| Custom / xAI | Chat Completions function tools, required tool choice and matching call IDs | Separate OS-stored API key; xAI official endpoint only |

Tool-use behavior follows the configured provider: Responses and compatible Chat Completions require function calls; Gemini uses `ANY`; Anthropic forces tool choice only for declared-compatible model IDs; Ollama relies on the fixed prompt and bounded recovery. Every name, argument, scope and finding is independently validated in Rust. OpenAI reasoning/Fast mode options are restricted to declared model capabilities and the official endpoint. Connectivity probes send no repository source and execute no repository tools.


Protocol references: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [Anthropic tool definitions](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), [Anthropic tool results](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls), [Gemini function declarations](https://ai.google.dev/api/generate-content#FunctionDeclaration), [Gemini thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures), [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling). These adapters are protocol-tested with fixtures; real account/model verification is still necessary before deployment.

## Limits and failure semantics

- 300-second run deadline, 60-second provider request timeout, 15-second bounded Git command timeout.
- Full review: 128 model turns, 256 total tool calls, 8 calls per response. Native requests use 2,048 requested output tokens per turn. Reply-only budgets are smaller; see the input-trust contract.
- 160 KiB per serialized request, 512 KiB cumulative request-byte allowance (reserving one possible retry per request), 512 KiB maximum provider response, 24 KiB per tool result and 128 KiB total successful tool context.
- 64,000 cumulative provider-reported tokens checked after responses. Byte/turn/output limits are not an exact tokenizer or a guaranteed dollar-cost ceiling; providers can bill already-sent requests and retries.
- 256 KiB text blob cap, 512 KiB raw per-file diff cap, 2 MiB changed-path inventory, 8 MiB tree inventory, at most 5,000 eligible changed paths per captured review.
- Native HTTP transport gets one retry for explicit 429/502/503/504 responses. Ambiguous network failures/timeouts are not retried automatically. ACP provider backoff/decode recovery is bounded in the shared engine and remains subject to the same run deadline and budgets.
- `completed` means structured submission and eligible changed-diff coverage under these checks; `partial` means a structured submission with known coverage limits. `failed`, `cancelled`, `incomplete` and `interrupted` do not masquerade as successful reviews. Already-sent model requests may still be billed after cancellation. An in-flight read-only Git operation may finish after cancellation.
- No-change snapshots return a deterministic no-change result without calling a model or recording approval.
- Snapshots whose changed paths are all excluded return a deterministic `partial` result explaining that no code was reviewed, with zero model requests or token usage.

## Verification

Run `pnpm typecheck`, `pnpm check:architecture`, `pnpm test`, and `cargo test --manifest-path backend/Cargo.toml --lib`.

Tests use temporary repositories, an in-memory SQLite database, protocol fixtures and a local HTTP fake provider. They cover fixed snapshots vs checkout/replacement refs, missing partial-clone objects without implicit network requests, deleted files, symlinks/path traversal, sensitive source/diff/search filtering (including private-key middle hunks and custom color/indicator settings), strict schemas, native call ID/signature continuation, HTTP retries, forbidden tools, evidence validation, no-change/prose/empty submissions, turn exhaustion/cancellation, durable/idempotent publishing without approval/resolution, interrupted-run recovery, remote consent, background lifecycle and stale frontend responses. They do not use real provider credentials, incur model charges, verify model review quality, or establish native behavior on untested operating systems.
