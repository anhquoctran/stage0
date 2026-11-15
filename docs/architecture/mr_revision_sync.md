# Automatic MR revision synchronization

Stage0 observes committed local Git refs for every tracked repository, including
MRs outside the active window. Synchronization updates the current MR revision;
it does not start an AI review or send source to a provider. Creation/manual
review requests and explicitly addressed discussion replies retain their own
admission, consent, budget and publication checks.

## Behavior

The process-wide native service starts after database initialization. It tracks
all open MRs and the most recent resolved MR for each repository/base/compare
pair when that pair has no open MR. Closed MRs and older resolved history stay
historical. Repository/session changes refresh this registry, with a periodic
reconciliation for changes made through other persistence paths.

The service resolves the MR's configured branch names, including the same
remote fallback rules used by review snapshots. A local commit advances a local
branch. An `origin/*` MR changes when that local remote-tracking ref advances
through a push/fetch; synchronization does not fetch, switch branches, stage,
commit or change working files. Unsaved editor changes, working-tree changes and
staged changes alone do not advance the MR revision.

When the base/head SHA pair changes, a SQLite transaction stores the new pair,
marks the revision as needing review, invalidates prior reviewer verdicts and
reopens a resolved MR. A running reviewer for that exact new pair keeps its
`reviewing` state. Existing discussions, anchors, findings, review snapshots and
user metadata are retained. Native status notifications use the existing MR
notification channel when a resolved MR reopens; notification failure cannot
roll back the transaction.

The workspace receives compact metadata events. Background MRs never trigger
commit/diff retrieval. Selecting an updated MR loads its commits using immutable
SHAs and refreshes the selected comparison. The UI distinguishes unreviewed
changes, unavailable refs and an older selected review snapshot. A commit does
not silently turn historical review evidence into evidence for new source.

## Resource bounds

| Work | Policy |
|---|---|
| Native subscriptions | One shared native watcher for this service; at most 256 repository roots. Watch only Git metadata roots and recursive `refs`/`reftable` directories, not source or object contents. Shared physical watch paths are reference-counted. |
| Overflow/failure | Unwatched repositories use polling. Foreground selection can replace the least recently focused native subscription. Registration failure leaves polling enabled. |
| Event storms | One pending entry per root; 750 ms quiet debounce, maximum 2 s accumulation delay. Changes during an in-flight scan schedule a subsequent scan. |
| Git workers | At most two concurrent synchronization jobs globally; job starts at least 250 ms apart. Full slots wait for completion rather than spinning on queued work. |
| Ref reads | Batch unique names for all MRs sharing a Git root. Normally one process for existing refs; up to three candidate rounds for missing/remote fallback refs. Changed results require a second matching observation. |
| Git subprocess | Per process: 15 s timeout, 2 MiB input, 8 MiB stdout, 16 KiB stderr. No replacement objects, optional Git locks, prompts, lazy fetching or network protocols. Shared activity leases coordinate updater installation. |
| Registry | Coalesced change-triggered refresh, at most once per second; periodic refresh every 30 s. |
| Reconciliation | Native subscriptions: 60–75 s. Poll-only subscriptions: 30–45 s. Repository-dependent jitter avoids synchronized bursts. |
| Errors | Exponential retry delay from 10 s up to 5 min. Foreground requests reset backoff. Unreadable refs invalidate old verdicts; an exclusive installation gate defers work without pretending refs disappeared. |
| Persistent cache | Per-repository epochs change on relevant session/reviewer transitions. Unchanged refs plus unchanged epochs return cached state without a SQLite write transaction or second Git inventory. Epochs are captured in the same transaction as the corresponding state. |
| Events/UI | Emit only changed generations in chunks of 64. Buffer metadata for 40 ms; coalesce foreground source refreshes for 100 ms, with one source refresh in flight per window. Focus requests coalesce for 2 s. |

Native Git callbacks only filter paths and mark queue entries. Git reads run in
blocking workers; no provider request runs in the monitor. Repository/session
removal prunes subscriptions and cached entries. Window cleanup removes listeners
and timers, rejects late responses, and handles late listener registration.
The existing active-workspace filesystem watcher remains a separate owner for
non-MR working-tree views; this service does not duplicate its source refreshes
when an MR is selected.

Under light load, native events normally reach the UI after the debounce and Git
read. The accumulation window is not a hard end-to-end latency guarantee: large
queues, slow/offline disks, OS event loss and backoff can delay reconciliation.
Poll-only roots intentionally trade latency for a bounded native-watch footprint.
There is no unbounded guarantee of near-realtime latency for arbitrary repo counts.

## Consistency and review publication

`virtual_mr_ref_state` stores the observed pair, availability, monotonic revision,
review-needed flag and metadata digest. Reviewer/session changes update
`virtual_mr_sync_epochs` through SQLite triggers. State, reviewer invalidation,
reopening and the returned cache epochs commit together. Reapplying an unchanged
scan does not rewrite timestamps or persistent rows.

Before applying a scan, persistence rechecks the repository path, branch pair,
existence and non-closed status inside the transaction. Obsolete work cannot
rewrite a subsequently edited session. A stale whole-session metadata save
cannot restore an approval for a different pair or restore resolved status over
an unreviewed revision.

Both runtime and manual publication verify the current local refs. The database
publication transaction also checks observed revision availability and SHAs.
Reply-only runs keep their full-review verdicts; only a completed full review can
clear review-needed state after all assigned verdicts are terminal. Current-head
finding evidence and discussion/evidence guards remain authoritative for native
and ACP providers.

Git ref writes by external processes and SQLite commits cannot form one atomic
transaction. A ref can move immediately after verification; the subsequent event
or reconciliation invalidates that verdict. Stored reviews always retain their
original immutable SHAs. The service never rewrites a review snapshot to claim
that it reviewed the new commit.

The existing `list_virtual_mr_sessions` IPC keeps its default serialized session
array. Optional `syncOnly: true` requests the lightweight synchronization state;
`requestSync: true` also prioritizes a local check. This read mode returns the
last durable observation rather than waiting for Git. Events complete the update.

## Verification

Behavior regressions cover external Git commits, remote fallbacks/packed refs,
Git-dir indirection, metadata filtering, shared watcher removal, burst fairness,
retry bounds, stale publication and metadata saves, repository isolation,
missing/offline refs, schema upgrades, historical discussion preservation and
1,000 MRs sharing one root. Window tests cover out-of-order events/hydration,
500-event coalescing, selection-only source loads, late completion rejection,
focus coalescing and subscription disposal. Cases are appended to
`shared/release-regressions.json`; existing frozen assertions remain unchanged.

On the development macOS machine, the isolated debug fixture with 1,000 MRs in
one synthetic repository measured approximately 261 ms for initial synchronization
and 68 ms for an unchanged cached scan, with zero SQLite writes in that cached
scan. These are illustrative local measurements, not production latency promises
or measurements of 1,000 repositories. Native Windows/Linux behavior must also
pass the protected CI matrix; it has not been executed locally on those systems.
