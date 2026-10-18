# AI Preferences transaction

Preferences creates one isolated draft store when opened. All provider fields
(including auth mode, model, endpoint, limits and prompts), MCP definitions,
global external agents and guardrail settings are edited there. Sandbox adapter
selection uses the same dialog's existing draft. No configuration editor writes
to the runtime stores, native policy or keyring before Apply/OK.

- **Apply** waits for persistence, advances the committed baseline and stays open.
- **OK** uses the same save path, closes only on success, and can close unchanged
  Preferences without requiring an artificial edit.
- **Cancel**, the close button and Escape discard changes since the last Apply.
  They do not revert already applied settings.
- **Reset to Defaults** changes drafts only. It neither deletes saved credentials
  nor resets committed font/provider/MCP/agent/policy settings before Apply/OK.
- During save, duplicate submissions and closing are blocked. Errors remain in
  the dialog, with pending drafts retained for retry.

API key replacements are temporary, per-provider draft values, so switching
providers cannot silently lose another provider's pending key. They are never
included in preference JSON, MCP exports, committed Zustand state or logs. Apply
sends one awaited native key/policy batch. The backend reads existing keys first,
restores earlier key writes if a later write fails, reports incomplete rollback,
and changes runtime policy only after the key batch succeeds. Existing OAuth and
Codex credentials are outside this API-key allowlist.

Secret-free preference records are written with compensating restoration on
storage/native failure; runtime stores are published only after native success.
This is a dialog transaction, not a distributed ACID database transaction: OS
keyring, localStorage and runtime policy are separate resources. Abrupt process
termination during a cross-resource commit cannot guarantee crash atomicity.

Untouched fields/groups preserve newer committed values (for example policy
hydration); conflicting edits are rejected instead of overwriting them. The
last committed guardrail policy is restored on startup before native hydration
so a fresh backend's balanced default cannot erase a saved strict policy.

Authentication, explicit connectivity tests/discovery, sandbox provisioning or
execution, copy/export and audit-log clearing are immediate actions, not draft
configuration. The UI states that Cancel does not undo them. Pending sandbox
selection blocks provisioning; pending guardrail edits block active-policy
simulation; draft MCP endpoints must be applied before network discovery.

Reviewer model overrides use the shared searchable dropdown, combining the
selected provider's preset list with already-cached discovered models. Inherited
provider/model labels resolve against the dialog's AI draft, not stale committed
settings. Opening or switching the form does not fetch models or read credentials.
Existing custom IDs remain selectable; manual entry is an explicit optional
Custom model choice. Saving the form updates only the Preferences draft.

## Credential access is explicit

Starting Stage0, opening AI Preferences, selecting a provider, and saving an API
key do not automatically read saved secrets or refresh cloud models. Provider
preset models remain available without credential access. Use **Check saved API
key**, **Check saved sign-in**, or **Refresh models** explicitly; the OS may ask
for access then. Pending requests are guarded against duplicate submissions;
denied access does not start a retry loop. Unsaved key drafts cannot be used for
model discovery. Google sign-in does not poll the OS credential store; check the
saved sign-in after returning from the browser.

ChatGPT's passive status IPC uses only backend-cached public metadata and expiry,
not the keyring, token refresh, or a provider request. After a process restart,
**Check saved sign-in** explicitly loads credentials. Polling a pending browser
sign-in reads that cache; completion updates it. Expired or locally cleared
sessions cannot remain connected through the cache. Tokens are not retained in
the polling runtime or sent to the frontend. Existing credentials and Keychain
access controls are not deleted, reset, or weakened by this change.

ChatGPT records use Windows chunking only on Windows. macOS/Linux use one native
item per record. Legacy imports on macOS forbid authentication UI and stop on
the first denied item; adding a new connection can reconnect while preserving
blocked legacy registrations. Sign-out suppresses legacy fallback before any
best-effort cleanup, so an undeleted old token cannot silently become active.

Tests cover every AI config field, isolated nested edits, per-provider key drafts,
Apply/OK/Cancel/close/Escape/reset, Apply followed by later cancelled edits,
failed saves, duplicate submissions, concurrent-setting conflicts and startup
policy restoration. Backend tests use in-memory keyring closures, never real
credentials. Platform keyring/browser UI still needs native smoke testing.
