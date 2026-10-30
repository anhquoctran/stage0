# Backend UI messages

Rust sends application UI messages as `stage0-message:` followed by a JSON
object containing `code`, scalar `params`, and optional `diagnostic`. Codes use
`backend.*` translation keys. The envelope remains a string so existing command
error types and DTO fields retain their wire shape. Locale data stays in the
14 frontend catalogs; no translated UI sentences are duplicated in Rust.

`common/messages.rs` owns encoding. Command handlers wrap failures only after
all domain handling, cancellation, cleanup and publication have completed.
Already-coded failures pass through unchanged. Internal errors, provider/Git
output and model-facing recoverable tool errors retain diagnostic text: they
must not be translated before engine classification or delivered to a model as
localized presentation copy. Diagnostic text is separate from interpolation;
frontend user-facing messages do not append it automatically.

`common/services/ipc/backendMessages.ts` validates and formats the envelope.
The i18n feature injects its translator at initialization; common code never
imports feature state. `localizePlatformMessages.ts` decorates the stable
platform ports once, covering normal replies, rejected commands, progress and
app-wide events without importing the native SDK. `BackendMessageError`
retains code, parameters and diagnostic data and resolves its message using
the current language when read.

Payload decoding is restricted to application error slots and recognized
status records. Preferences contents/settings, Markdown, review summaries,
generated descriptions, commit messages and source snippets are never decoded.
Native push notifications and native menu labels continue to use Rust's shared
catalog lookup, since those surfaces can be presented without an active webview.

Use `messages::code` or `messages::message` at the producer for actionable UI
states. The domain failure codes are fallback summaries for unexpected errors;
they do not replace internal diagnostics. New specific failures should have a
stable code and parameters rather than adding English matching in frontend code.

Verification: `scripts/backend-messages.test.mjs` covers all transport paths,
current-language error access, parameter preservation, malformed input, immutable
snapshots, protected authored content and wrapper identity. Rust message tests
cover envelope shape and nested-command idempotence. Run the normal locale key
checker when adding codes.
