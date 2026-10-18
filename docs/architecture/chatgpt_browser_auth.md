# ChatGPT browser sign-in

The default OpenAI subscription connection uses direct Sign in with ChatGPT for
open-source native clients. It opens the system browser once, receives a loopback
callback and verifies the identity before activating any credentials. No Codex
CLI, API key or client secret is needed. This is browser OAuth with PKCE, not a
device-code ceremony.

In Preferences → AI → LLM Providers → OpenAI → Subscription, explicitly select
**Check saved sign-in** after restarting Stage0 to load registrations from the
OS keyring (which may request authorization). Then choose a saved
connection or add an account/workspace, then select **Continue with ChatGPT**.
Return to Stage0 after approval. Closing Preferences leaves the pending attempt
running; reopening restores metadata. Cancel closes the local flow, but does not
revoke permissions the user may already have approved remotely. The local wait
limit is ten minutes.

## Boundaries

- Each attempt has fresh state, nonce and PKCE verifier. The callback listens only
  on `127.0.0.1` with `/auth/callback`, uses the exact same redirect URI in the
  token exchange, checks Host and state, rejects duplicate parameters, decodes
  query values, and bounds connections, request size and socket timeouts.
- Initial registration uses the documented dynamic entrypoint and stable host ID.
  The callback's issued client ID is saved before code exchange, so a failed or
  expired exchange can retry that registration rather than register again.
- Discovery is issuer/endpoint-pinned, redirects are disabled, and JWKS/revocation
  URLs are restricted to the HTTPS auth origin. ID tokens use the maintained
  `jsonwebtoken` library to check asymmetric signatures, key IDs, issuer,
  audience, expiry, nonce and authorized party. Returning identities must match
  the selected registration; email is only display metadata.
- Sign-in and plan permission are separate. Only granted scopes enable the plan
  permission indicator. A saved sign-in is not a model/quota connectivity test.
- Tokens are returned only to backend code and saved in OS keyring records. There
  is no plaintext fallback, browser-storage persistence or raw token/error logging.
  Windows records are base64-chunked below Credential Manager's per-password
  size limit; all chunks are written before swapping the generation manifest.
  macOS and Linux use one native item per record in a separate v3 namespace,
  without unnecessary Windows-sized chunks. Base64 is only Windows framing:
  OS keyring protection, not base64, secures the values.
  Existing chunked records are imported only when a new-format item is absent.
  On macOS every legacy read forbids authentication UI; the first permission
  error stops the import, preserving old items instead of prompting per chunk.
  Explicitly adding a new connection can reconnect without importing blocked
  legacy registrations; it does not overwrite or delete their old records.
  Native sign-out suppresses legacy fallback before cleanup, using a secret-free
  tombstone only for legacy-backed records. Incomplete cleanup is reported, not
  retried with more prompts; native-only retired sessions are deleted normally.
- Up to twelve distinct registrations can be retained, including registrations
  with identical emails. The selected connection is reauthorized or refreshed
  before becoming active; the prior active connection remains separate while a
  new login is pending or fails. Saved metadata polling never contacts OpenAI
  or reads the keyring: it uses only cached public metadata and session expiry.
  Browser completion and explicit saved-sign-in/refresh/sign-out actions update
  the cache; no access or refresh tokens are retained in that polling runtime.
- Refresh and sign-out are explicit operations serialized in the backend. Refresh
  uses the connection's issued ID, replaces rotating credentials, retains granted
  scopes when omitted on refresh, and distinguishes terminal refresh errors from
  temporary failures. Sign-out attempts remote revocation, then clears local
  credentials while retaining registration identity; unconfirmed revocation is
  explicitly reported. Stored connections are never merged by email.
- Legacy direct-browser secrets are not imported or deleted. The old unverified
  token decoder and Chat Completions subscription path have been removed. Codex
  managed device-code sign-in remains an advanced, isolated alternative.

**Subscription inference is not yet wired into the review harness.** This auth
change makes no inference/billing request and never treats a subscription token
as a saved API key. A separate Responses adapter must preserve source-sharing
consent, streaming terminal/error semantics, account-specific models and budgets.

## Verification

Keyring diagnostics are emitted to the native backend's stderr with the
`[Keychain]` prefix, including production builds launched from a terminal. They
appear in the terminal running `pnpm dev:app`, not the frontend browser console.
Restart the native app after changing this instrumentation; frontend HMR alone
cannot update Rust logging.

Each write has a process-local `op` ID, safe record kind and layout, `planned`,
`attempted`, `written`, `failed`, `not_attempted`, `committed`, and separate
rollback counters. Windows totals include chunks **and** the manifest; native
records need one item. The start event precedes OS calls, so a permission wait
shows the current progress. Summaries are emitted on success and early failure.
`written` counts successful write calls in that operation, including replacements,
not newly created items or the total inventory currently in the Keychain. A
failed transaction can have successful writes later rolled back: check
`committed` and rollback counters rather than interpreting `written` as durable
transaction success. Repeated catalog saves are separate operations, not new
accounts. Passive read logs use `action=read` and never increment write counters.

Logs never include values, passwords, tokens, raw errors, email addresses, key
identifiers, profile IDs or generation IDs. Counting does not add keyring reads,
inventory scans, retry loops, ACL changes or secret exposure to the frontend.

Local tests use a test-only, thread-local fake keyring, fresh RSA signing fixtures
and local TCP callbacks; they never read real credentials or sign into OpenAI.
They cover rejected signatures/claims, state/client/Host/path binding, duplicate
parameters, late polling, cancellation controls, metadata projection, separate
registrations, failed keyring writes preserving the previous generation, and
passive polling with zero additional keyring reads. Tests exercise both the
Windows chunk format and single-item native format using fakes, including
large values, denied imports, failed writes, reconnect and sign-out tombstones.
Cache expiry and local sign-out fail closed without silently rehydrating credentials.
Live account eligibility, provider responses and native keyring/browser behavior
still require a real desktop smoke test on each operating system.

## Official references

- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [OIDC discovery and signature verification](https://developers.openai.com/siwc/website)
- [Subscription inference contract](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)

OpenAI Docs determined the registration, verification and session contracts;
Stage0 does not use private Codex OAuth client IDs or undocumented device grants.
