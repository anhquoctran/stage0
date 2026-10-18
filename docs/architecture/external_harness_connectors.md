# External MCP / CLI connector preparation

## Delivered scope

This change prepares extension points and real, source-free capability discovery. It does **not** grant an external server or CLI access to review runs or the host. Existing native review behavior, filtering, evidence checks, cancellation, budgets and explicit publishing remain in effect.

| Connection path | Current capability | Not enabled |
| --- | --- | --- |
| Native API / Ollama | Existing native model adapter and read-only tool loop | Host execution, MR approval, automatic fix verification |
| MCP Streamable HTTP | Explicit initialize → initialized → tools/list discovery, JSON/SSE responses, pagination, best-effort session cleanup | Tool calls/attachment, OAuth/secret binding, newer MCP revisions |
| MCP stdio | Saved launch configuration | Executable launch, package installation, host filesystem access |
| Legacy HTTP+SSE | Saved configuration, preserved by typed import/export | Legacy endpoint-event transport |
| CLI | Non-executing PATH preflight; versioned structured wrapper codec; shared-runtime adapter seam tested with an emulator | Real CLI model execution, auth detection, arbitrary command/agent invocation |

## User workflow

Open **AI Preferences → MCP Servers**, or **AI code review**, and expand **External MCP / CLI connectors · preparation**.

1. Add a connection with transport **Streamable HTTP** and an endpoint such as `http://localhost:8000/mcp`; this saves configuration only.
2. Acknowledge source-free discovery for that endpoint, then click **Discover tools**. Consent is consumed by the action and reset after configuration edits. Nothing connects on startup, render, import, enabling a configuration or starting a review.
3. Inspect the discovered catalog, server identity, protocol revision, deterministic namespace and catalog fingerprint. Results always say **not attached to harness**. There is no enable/attach shortcut.
4. Use **Inspect executable** for CLI readiness. This checks filesystem entries on PATH only; it does not run `--version`, inspect auth files, launch a shell, authenticate, install packages or invoke inference.

Discovery state is ephemeral and bound to the exact current connection ID/type/URL/enabled setting. Late responses cannot replace a newer endpoint attempt or restore a deleted connection. Config import/export preserves `http`, `sse` and `stdio` explicitly; a URL-only newly imported definition defaults to Streamable HTTP. Legacy imported definitions should specify `type: "sse"`. Discovery catalogs and successful connection claims are not persisted or exported as authorization.

## Model adapter vs tool executor

`ReviewModelAdapter` defines conversation creation, request construction, inference, response decoding and correlated tool-result continuation. `NativeModelAdapter` wraps the existing provider codecs without changing their wire protocols. A future reviewed CLI wrapper can implement the same trait.

`runtime::execute_with_adapter` owns the turn loop and all shared limits. It dispatches only through the active `ReviewToolRegistry`, validates schemas, reads fixed snapshots, checks evidence and persists findings. Model adapters produce tool requests; they do not gain a public API for executing host operations or publishing/approving results.

The trait is an architectural seam, **not an OS security boundary**. An arbitrary executable can ignore instructions/flags or access files using its own built-in tools. The legacy `ai_execute_cli` prompt runner is intentionally not used by this harness. Login status, a successful prose reply or a `readOnlyHint` annotation does not establish compatibility or safety.

## MCP discovery profile

The client is explicitly pinned to MCP **2025-11-25**, not advertised as the newest revision. Its implementation follows that revision's [transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) and [tool](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) contracts. A different negotiated revision fails closed rather than silently reusing the wrong lifecycle. Newer stateless discovery requires a separate versioned adapter.

- Only `initialize`, `notifications/initialized` and `tools/list` are allowed. The client has no general RPC or `tools/call` entry point.
- Client capabilities are empty: no roots, sampling, elicitation, task delegation or access to local repositories. Server instructions and remote icons are ignored and never inserted into model context.
- Accepts `application/json` and bounded `text/event-stream` responses, validates JSON-RPC version/response ID, carries session and negotiated protocol headers, rejects server-initiated requests, detects repeated cursors and duplicate tool names.
- Session IDs remain private in client memory, are not returned/logged, and receive a best-effort DELETE after success, error or the discovery deadline. A server may refuse cleanup or be unreachable; discovery is not a persistent connection lease.
- HTTPS is required except loopback HTTP. Embedded credentials, query strings, fragments, redirects and inherited proxies are refused. No provider key, MCP environment variables, launch arguments, cwd or repository source are sent. Authenticated servers return a clear HTTP error; there is no implicit OAuth or credential reuse.
- 10-second request timeout; 30-second discovery deadline plus at most 2 seconds for cleanup; two concurrent discoveries; five catalog pages; 100 tools; 16 KiB per schema; 256 KiB per response and 512 KiB total response bytes; at most 32 SSE events per response. No automatic retry/resume.
- Namespaces are deterministic hashes of connection identity and original tool name, preventing a discovered `submit_review` from replacing the native finalization tool. Endpoint and catalog fingerprints support a future configuration-bound approval lease.
- Catalog schemas/annotations are untrusted metadata. They are retained for inspection, not resolved, fetched, converted into strict provider schemas or added to prompts. `readOnlyHint: true` is never authorization. External names remain rejected by the native registry.

The existing MCP environment editor still stores values in ordinary local preferences/config exports. This preparation does not migrate those values into secure storage or forward them to any process. Do not put secrets in those fields.

## Structured CLI wrapper contract

The proposed Stage0-owned wrapper protocol is `stage0-review-cli-v1`; this is **not** a claim that Claude Code, GitHub CLI, gcloud or Grok natively implement it. A real adapter must translate an officially supported machine-readable protocol and enforce host/sandbox permissions independently. For example, [Claude's programmatic interface](https://code.claude.com/docs/en/headless) documents structured output and tool permissions; simply calling its print mode is not equivalent to this harness contract.

One turn request is one JSON object containing:

```json
{
  "protocolVersion": "stage0-review-cli-v1",
  "system": "fixed Stage0 review policy and review preferences",
  "history": [],
  "tools": [],
  "maxOutputTokens": 2048,
  "capabilities": {
    "hostExecution": false,
    "hostFilesystem": false,
    "automaticApproval": false
  }
}
```

Only filtered, bounded harness history may populate it. No repository cwd, raw environment or credentials are part of the contract. Capability booleans are declarations, not a substitute for process isolation.

A wrapper reply contains exactly these three fields:

```json
{
  "protocolVersion": "stage0-review-cli-v1",
  "toolCalls": [{ "id": "call-1", "name": "get_diff", "arguments": {} }],
  "usageTokens": 100
}
```

The codec bounds request/response sizes, requires 1–8 calls with unique IDs, validates each against the active registry and requires an exclusive `submit_review`. Prose, arbitrary success flags, unknown fields, terminal tools and direct finding/approval payloads fail closed. Only the common runtime can validate snapshot-bound findings. A test-only CLI emulator exercises this contract through the same review loop, demonstrating that source redaction and evidence checks survive adapter substitution without starting a real process.

## Gates before actual attachment

1. Define backend-owned approval leases bound to user-approved endpoint/executable identity, catalog hash, tool allowlist, session, fixed snapshot, budgets and expiry. Revalidate after configuration/catalog changes; never trust an imported approval flag.
2. Bind external credentials to endpoint identities in the OS credential store; implement scoped OAuth without token passthrough, secret export or reusing model-provider keys.
3. Implement full JSON Schema support/strict-schema projection, pinned tool-catalog provenance and validated, bounded, redacted text-only tool outputs. Remote `$ref`, rich media, prompts and resource contents must not be fetched implicitly.
4. Require a verified read-only/snapshot contract or suitable sandbox. Arbitrary MCP filesystem tools can observe the wrong checkout and arbitrary stdio/CLI tools can bypass Git filtering; server annotations and command-line permission flags alone cannot establish isolation.
5. Add explicit launch/per-call approval, credential-minimal subprocess environments, native executable/argument handling across platforms, process-tree cleanup and cancellation/timeout tests. Never execute an untrusted `.cmd`/`.bat` command via string-interpolated `cmd /C` as a shortcut.
6. Attribute tool execution and model usage to a connection/adapter fingerprint in the existing metadata trace without logging secrets, full prompts or provider reasoning. Keep final evidence checks and publication under the existing runtime.

## Verification

`pnpm typecheck`, `pnpm check:architecture`, `pnpm test`, and `cargo test --manifest-path backend/Cargo.toml --lib` cover the integration seams and regressions.

Tests use local HTTP fixtures (no real external services), JSON/SSE protocol fixtures, temporary Git repositories and a test-only CLI emulator. They verify initialization/headers, pagination, cleanup, malformed IDs/cursors/catalogs, unsupported revisions, redirects/auth/response limits, no source/secret/host-tool transmission, endpoint-consent changes, stale responses, typed import/export and registry denial after discovery. Actual MCP deployments, account authentication, real CLI execution, model quality and native UI behavior on other operating systems remain unverified.
