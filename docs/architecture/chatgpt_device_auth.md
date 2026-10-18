# ChatGPT device-code authentication

This is now an **advanced, optional** connection. The default subscription flow
is [direct browser sign-in](chatgpt_browser_auth.md), with no Codex CLI requirement.

Stage0 delegates device-code authentication to the installed official **Codex
app-server**. This uses Codex-managed authentication, not a Stage0 OAuth client or
a subscription token passed to an API-key adapter. A separate OpenAI Auth Client
is not needed for this integration. Direct, Stage0-branded OAuth registration is a
different integration and is not implemented by this flow.

## Using it

1. Install/update the official Codex CLI and make it available on `PATH`, then
   restart Stage0. Windows requires a native `codex.exe`; shell wrappers are not
   executed. Stage0 does not install or update Codex automatically.
2. Allow device-code login in ChatGPT security settings (or ask your workspace
   administrator to enable it).
3. In Preferences → AI → LLM Providers, choose OpenAI and subscription
   authentication. Expand the advanced Codex-managed device-code section, allow
   launching the installed Codex service and select **Continue with ChatGPT**.
4. Open the displayed official page and enter the one-time code. Stage0 waits for
   the matching completion notification and reads the account back from Codex.

The reported account and plan are metadata, not proof of model entitlement or
remaining quota. **This change implements authentication only. It does not wire
subscription inference into the review harness.** The old direct-browser OAuth
path has been replaced with verified direct browser sign-in. Browser credentials
remain separate and are not migrated into the Codex profile or used as a fallback.

## Credentials and process boundaries

- A child-only `CODEX_HOME` points to `app_local_data_dir()/codex-auth`. The user's
  normal Codex profile is not read, imported, signed out or modified. The profile
  is secured to mode 0700 on Unix and rejects a symlink as its leaf directory.
- Codex is configured with `cli_auth_credentials_store="keyring"`, with no
  plaintext-file fallback. Missing OS keyring support fails explicitly. Codex
  owns credential storage and refresh; Stage0 does not return access, refresh or
  ID tokens through IPC, persist them in frontend storage, or log raw responses.
- Only initialize, account read, device-code start, cancel and logout requests are
  allowed. No repository files, inference requests, tool calls or API billing
  requests are sent by this adapter. Inherited API credential overrides are
  removed from the child environment.
- Opening Preferences or polling status reads cached metadata only. Start, saved
  sign-in check and sign-out explicitly launch the auth-only process. It runs in
  the isolated profile directory, not a repository working directory.
- Device instructions must contain the pinned HTTPS
  `https://auth.openai.com/codex/device` URL and a bounded printable code. Public
  metadata is projected on both sides of IPC. Pending codes are cleared at every
  terminal state. Responses, output buffering and request durations are bounded.
- Closing Preferences does not cancel a pending login. Reopening it recovers
  cached progress. Cancellation is attempt-bound and best-effort: authorization
  may already have completed remotely. Use **Sign out Stage0 Codex profile** to
  remove any saved session. Logout only affects this isolated profile.
- A local ten-minute wait deadline is not the provider's code expiry. Codex may
  reject or expire a code sooner. Worker completion, cancellation and application
  exit clean up the child process tree using the shared platform-specific process
  helpers. Late notifications cannot restore a cancelled code or another attempt.

## Verification and remaining integration

Backend tests use a test-only stdio app-server fixture. They cover matching and
incorrect completion IDs, unsupported flows, denial, spoofed URLs, API-key
accounts, oversized output, cancellation, saved account checks and logout.
Frontend tests cover explicit launch consent, metadata-only polling, stale
responses, field projection and browser-only failure. No real account login,
OS-keyring round trip or Windows/Linux runtime validation was performed.

Before using a subscription for code review, implement and validate a separate
Codex model adapter with source-sharing consent, tool permissions, usage/error
reporting and cancellation. Do not reuse these credentials as API keys.

## Official references

- [Codex app-server: managed account/device-code flow](https://learn.chatgpt.com/docs/app-server#3b-log-in-with-chatgpt-device-code-flow)
- [Codex authentication: device-code settings and credential storage](https://learn.chatgpt.com/docs/auth)
- [Direct sign-in for open-source integrations](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

These official interfaces determined the transport and credential ownership. No
private OAuth client ID, undocumented device endpoint or CLI-cache extraction is
used by this implementation.
