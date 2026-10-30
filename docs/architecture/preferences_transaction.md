# Preferences commit protocol

`commit_preferences_transaction` is the single native Apply/OK/onboarding entry
point for JSON preferences and API/MCP credentials. The browser preview keeps its
single JSON patch and cannot save native secrets. `commit_ai_preferences` and the
single-key IPC commands retain their names and delegate to the same coordinator.

## Commit and isolation

The Rust blocking worker owns the publication mutex through persistence and
publication. The manager holds its local mutex, process-wide write mutex and OS
file lock while checking the expected revision, validating the complete candidate,
preparing credentials, and replacing preferences.json. Cancellation of the IPC
waiter does not cancel this worker. Another cooperating writer cannot interleave.
The revision is checked again after preparation because external editors may
ignore the advisory lock. Noncooperating external writers cannot participate in
Stage0's isolation protocol.

Prepared secrets are new immutable OS Keychain objects. SQLite stores only opaque
identity-to-Keychain mappings under `txn/<uuid>`; each insertion uses FULL SQLite
durability before the JSON commit. Ordinary preferences, including both language
settings, stay exclusively in JSON. Secret payloads remain in the Keychain and
zeroizing native buffers, never JSON, SQLite values, recovery files, events or logs.

The non-secret `credentialReferences` map in JSON selects the prepared identities.
A null entry is a committed removal and forbids falling back to the old legacy
credential. Readers resolve the map from an atomically read document. Existing
unversioned AI/MCP credentials remain readable until that identity is changed.
JSONC save/patch cannot modify these references; resetting ordinary preferences
preserves them so removed credentials cannot reappear after Reset.

The atomic replacement of preferences.json is the sole commit point. Before it,
all prepared items are unreachable and the old snapshot remains active. After it,
all referenced mappings and Keychain objects have already been acknowledged.
File contents and the parent directory are synchronized on Unix; Windows uses
write-through replacement. A flush error after replacement is reported as an
indeterminate durable outcome, reconciled from disk, and never followed by a
compensating overwrite or deletion of potentially committed credentials.

Only after commit does Rust apply runtime preferences, rebuild menu labels and
broadcast preference/language events. The existing event names and payloads are
retained. A process-scoped publicationSequence on documents prevents late IPC
responses from replacing a newer WebView snapshot; it is not a persisted setting.
Frontend drafts and baselines advance only after native success. No frontend
JSON rollback is required. Startup guardrail hydration is read-only.

## Recovery and cleanup

Cold startup protects references reachable from the primary document and the
last-known-good document. It deletes only unreachable prepared Keychain objects
and mappings; failures leave retryable garbage. Referenced versions are retained
for the whole process lifetime, so cleanup cannot race an active reader. Legacy
identities can be retired only when both recoverable documents explicitly select
versioned credentials or removals for them. Invalid/unreadable primary documents
defer cleanup. Recovery never chooses staged credentials merely because they exist.

## Scope and verification

The transaction covers Stage0's committed preference document and the credential
objects reachable from it, using the filesystem, SQLite and OS Keychain durability
contracts. Arbitrary external modification or deletion of those stores is outside
that contract. PATH, autostart registration and other OS effects remain desired-state
reconciliation after commit; they are not transactional participants.

`preferences/commit_tests.rs` exercises staged-write failures, validation/revision
conflicts before staging, immutable MCP changes, read-only references, Reset and
reopen. Child-process tests terminate after a durable fake-vault preparation and
after commit before any response; reopening must select the old or complete new
snapshot. Existing publication tests cover serialization and cancelled IPC waits.
These fault tests do not claim native Keychain execution or physical power-cut
coverage on Windows, macOS or Linux.
