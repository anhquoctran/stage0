# Repository settings document and commit protocol

`.stage0/repos.json` at each Git worktree root is the sole authority for Stage0
repository configuration. The `.json` extension intentionally retains JSONC syntax
(comments and trailing commas), like Preferences. Remotes, branches and tags remain Git operations.
Ordinary settings, reviewer definitions/selections and labels share one document;
no credentials, absolute machine paths, SQLite repository ID or source-transfer
consent are exported. JSONC comments and unrelated formatting survive UI patches.

## Schema and initialization

Schema version 1 requires `schemaVersion`, `defaultBaseBranch`,
`inheritGlobalAgents`, `customAgentRules`, nullable `activeAgentIds`,
`customReviewers` and `labels`. Null agent selection means enabled available
reviewers; an empty list intentionally selects none. IDs are opaque and
repository-scoped. Unavailable global reviewer/provider/ACP references do not
install or execute anything. ACP source-transfer consent is local to the machine,
repository and exact reviewer configuration; modifying the file cannot grant it.

The backend rejects duplicate keys (including escaped equivalents), unknown
fields, invalid types/version, invalid ref syntax, malformed/duplicate labels and
reviewers, credential-shaped values, documents over 1 MiB and nesting over 16.
Existing reviewer domain limits apply. Reads bound actual bytes, reject known
symlinks/reparse points and require UTF-8. Read handles are short-lived; there is
no fs2/flock/advisory lock, `.lock` file or exclusive sharing on repo documents.

Repository opening initializes a missing file without clobbering a concurrent
creator. Fresh repos choose a usable main/origin-main/master ref, another local
ref, or HEAD. The first upgrade imports existing SQLite scalar settings/labels
before their rows become a projection, preserving historical MR label links.
Reviewer data formerly in localStorage remains available through an explicit
Import button in Repository Settings and is removed only after commit succeeds.
Consent is not imported. Existing JSONC always wins. Recovery presence prevents
a deleted file from resurrecting old SQLite settings on a later opening.

## Transactions and recovery

All Stage0 writers share a per-canonical-root in-process coordinator, including
legacy settings/label IPC facades. A blocking worker owns the gate through disk
commit, label projection and event publication even if its IPC waiter goes away.
Revision hashes are mandatory. The complete candidate is validated before any
primary write; the revision is rechecked immediately before replacement.

A same-directory temporary file is flushed, atomically replaces the primary,
and its directory is synchronized on Unix. Windows replacement uses write-through;
initialization omits replacement and never clobbers another creator. The primary
replacement is the commit point. Only afterwards are runtime snapshots/events
published. Publication sequence numbers reject late responses in the frontend;
frontend snapshots are frozen and queued mutations use acknowledged revisions.
Scalar dialogs retain their baseline and draft when externally changed fields
conflict. Labels/reviewer transactions do not erase unrelated scalar drafts.

A validated last-known-good copy lives under the per-user app-data directory
`repo-settings-recovery/<root-hash>.jsonc`, outside the Git worktree. Invalid
external content remains untouched, with an explicit validation error and the
last valid runtime snapshot. No backup means an actionable error rather than a
silent default. Repair the file externally and Refresh to load it again. Missing
files are initialized; malformed/empty/unreadable files are not treated as missing.

Failures before replacement preserve the old snapshot. Failure after replacement
with uncertain durability reconciles from disk and reports an indeterminate
result; it never performs a compensating overwrite. Recovery updates after commit
are best effort. SQLite label rows are a rebuildable projection; projection
failure reports that the document committed and needs reload. File plus SQLite
are not claimed as a distributed atomic transaction. Existing MR history remains
SQLite-owned. Legacy label IDs are retained where already owned by this repo;
other clones derive stable repo-scoped IDs, avoiding collisions in the same DB.
Labels omitted by a checkout are hidden from configuration; referenced database
rows are retired rather than cascade-deleting historical MR relations.

ACID applies to cooperating operations through the one Stage0 process: complete
snapshot commit, schema consistency, serialized writers and acknowledged durable
writes. Arbitrary external editors do not participate in isolation. Revision
checks detect stale edits but cannot eliminate the final check/rename race with
a noncooperating writer. Filesystem durability depends on the OS/storage contract;
network filesystems and hostile same-user directory replacement are not additional
guarantees. No file lock is introduced to claim stronger cross-process isolation.

## Verification

Rust tests cover validation/resource bounds, stale and competing writes, explicit
recovery, injected failures before/after replacement, open editor handles,
no-clobber initialization, symlinks and per-clone label/MR references. Child-process
exit tests reopen the old snapshot before commit and the complete new snapshot
after commit before an IPC response. These are not physical power-cut tests.
Node tests cover publication on acknowledgement, queue ordering, stale responses
and local ACP consent. React tests cover draft preservation, conflicts and Cancel.
Native filesystem checks run locally on macOS; Windows/Linux require native CI.

## Internal source editor

The left footer action opens repos.json in the existing JSONC editor surface,
with a repository-owned document adapter. It shares highlighting, line numbers,
indentation, scrolling and two-second autosave with Preferences. Repository editing
does not call the global Preferences persistence service or offer its completions,
schema URI or Reset action. A full-source save uses the same native coordinator,
validation, revision check, durable replacement and publication as structured
settings patches. Unlike patches it may repair an invalid primary document.

The editor retains invalid/conflicting drafts and exposes Reload. Closing the editor with its X button or Escape awaits an active autosave and saves any newer text before
closing; failure keeps the editor open. An untouched settings form hydrates the
new values, while a dirty form retains its draft and reports conflicting fields.

## Earlier filename compatibility

When repos.json is absent but `.stage0/repos.jsonc` exists, Stage0 validates and
copies the old file byte-for-byte using no-clobber initialization. The old file is
retained to avoid deleting external edits. Once repos.json exists it is the sole
authority; the old filename is ignored. An invalid old file is reported without
creating defaults or altering it. The internal recovery filename is unchanged.

The Preferences and repository source editors share the same explicit X close
control. Escape dismisses an open completion list first; otherwise it closes the
editor through the same save-aware path and does not dismiss the parent settings
dialog. Concurrent close requests are coalesced while a save is pending.
