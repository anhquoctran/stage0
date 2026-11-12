# Calendar release rollups: Develop → Beta → Stable

Nightly is retired permanently. `scheduled-release.yml` is removed and its
GitHub workflow is disabled. New Nightly tags, manual builds, release manifests
and update feeds are forbidden. Historical tags remain reserved version numbers;
reading their provenance does not enable publishing that channel.

## Calendar and source eligibility

| Target | Source | Complete half-open UTC window | Planning/publication day |
| --- | --- | --- | --- |
| Beta | Tested PR merges into Develop | Previous month day 28 through end of current month day 26 | Day 27 |
| Stable | Published, signed Beta releases | Entire preceding calendar quarter | January/April/July/October 1 |

Beta on 2026-11-27 includes merges in `[2026-10-28T00:00Z, 2026-11-27T00:00Z)`.
Stable on 2027-01-01 includes Beta publications in
`[2026-10-01T00:00Z, 2027-01-01T00:00Z)`, including December 27. There is no
rolling 24-hour activity requirement for monthly accumulation. Periods cannot
freeze before cutoff or publish after the scheduled UTC day. Planning starts at
00:00 UTC; reviewed assembly and native builds take time, so publication occurs
after completion on that day rather than promising an exact midnight launch.

### Develop sources for Beta

`scripts/release-development-source.mjs` inventories merged PRs from GitHub using
**server merge timestamps**, not author/committer dates. Each merge SHA must
still belong to Develop's first-parent history. Authentication/network/history
failures abort the plan rather than becoming an empty period.

A source must satisfy all of the following:

- Closed, merged canonical Develop PR with matching immutable merge SHA/time.
- Merged Git tree exactly equals its tested PR-head tree. A conflict resolution,
  unrelated target change or unsynchronized merge cannot borrow old head CI.
- The latest exact-head `regression.yml` and `policy-tests.yml` PR runs succeed
  before cutoff. All Linux/macOS/Windows regression jobs and policy jobs pass;
  skipped, pending, cancelled, missing and failed jobs do not certify a source.
- Frozen workflow run titles identify the PR number, Develop base and tested SHA.
  GitHub clears `workflow_runs.pull_requests` after closing PRs, so that transient
  array is not durable evidence. Runs from before this title contract was
  deployed are not silently grandfathered in: a newly tested source snapshot is
  required. Later successful snapshots include their inherited earlier fixes.

The ledger records `develop/pr-N/<merge-SHA>`, tested head, server merge time,
workflow run IDs/attempts/completion times and unique commits. A failed source is
listed with its rejection reason. A successful later snapshot may include an
older failed snapshot's commits only as part of its newly tested tree. This is
CI eligibility, not a declaration of stability: human review/QA and final
assembled-tree checks remain mandatory. No development binaries are published.

### Published Beta sources for Stable

`scripts/release-promotion-source.mjs` verifies immutable tag/source provenance:
one explicit source parent and only generated release metadata in the snapshot.
The latest exact-tag/SHA `release.yml` attempt must succeed, including validation,
publication and all six native platform jobs. Require eleven packages, nine
updater signatures, `latest.json`, `SHA256SUMS.txt`, nonempty uploaded assets and
no replacement after the certified run. A newer failed/pending run, missing
asset or mutable provenance rejects the source. API errors abort selection.

## Assembly and regression protection

Accumulate every eligible snapshot in chronological order using Git plumbing.
Deduplicate common commits while retaining independent changes, reverts and
original source ancestry. Preserve target-only hotfixes; reject explicit reverts
of already-integrated target commits. Only the reserved rollup ledger is
normalized as metadata. Application conflicts stop assembly; never auto-resolve
with ours/theirs, omit a source or cherry-pick only convenient changes.

`.github/release-rollup.json` stores the complete frozen inventory, skipped
sources, target baseline SHA, unique commits and evidence. Recompute it before
approval/publication. A moved target, pruned source, changed run attempt, altered
asset or moved head invalidates the entire batch. Regenerate and review a new
head; never force-push a reviewed rollup.

Protected tests and fixtures remain append-only. Baseline assertions execute
against candidate code, followed by the candidate suite. The original
published-snapshot rollup tests retain their assertions and use an explicitly
historical policy in their fixture adapter. New protected tests exercise the
live Develop source policy, retired-channel rejection and updater isolation.
Changing an adapter/control plane requires the explicit promotion checkbox
`Regression control-plane changes reviewed.`; it does not silently waive any
assertion, source provenance, QA or approval requirement.

Testing reduces regression risk; it cannot prove arbitrary feature changes safe.
Smoke QA, known-issue review and independent human approval remain necessary.

## Operator procedure

1. Merge ordinary work through checked PRs into Develop. All changes stay in the
   single repository worktree; no daily release or intermediate channel exists.
2. On the release day, `Accumulate periodic releases` runs trusted `main` code
   via `promote-release.yml`, inventories the full closed period and opens
   `promotion/beta/YYYY-MM-DD` → `beta` or
   `promotion/stable/YYYY-MM-DD` → `main`. No eligible/new changes means no
   branch, PR, version, build or release.
3. Close/reopen the bot-created PR once to activate CodeQL when GitHub's
   `GITHUB_TOKEN` event suppression prevents automatic PR workflows. Run all
   required Actions and exact-head CodeQL for Actions, JavaScript/TypeScript and
   Rust; reject current High/Critical alerts.
4. Review every selected/rejected source and known issue. Complete both checklist
   items in the PR body:
   - `Smoke-tested install/update, launch, diff and reviewer on supported platforms.`
   - `Reviewed changes and known issues; ready for this channel.`
   Complete the control-plane acknowledgement if requested. Obtain an independent
   human approval of the exact head from a trusted collaborator.
5. Merge through the protected PR using a merge commit on the scheduled UTC day.
   Never squash/rebase. The merged tree must still equal the approved tree.
6. `publish-rollup.yml` uses the trusted Main controller. Wait up to 20 minutes
   for exact-merge CodeQL only; other security/approval failures abort immediately.
   Revalidate complete source evidence once after CodeQL, check the current
   channel head and immutable ledger, then prepare one versioned snapshot/tag.
7. Dispatch isolated tag-ref validation and all six native builds. Run frozen
   target Node/Rust regressions unconditionally, the complete candidate suites,
   architecture/type checks, then sign and verify all packages before publication.
   Revalidate release authorization immediately before publishing and updating
   the fixed Beta/Stable feed. Already-published sources are never rebuilt.

The release workflow rejects retired tags both in push filters and its job gate;
manual/tag/script entry points also reject unsupported channels before dispatch.
Raw Stable tag pushes cannot publish; approved controllers/manual execution
retain the promotion authorization checks. Caches/secrets remain scoped to
isolated tag builds; trusted controllers never execute candidate scripts.

## Certified urgent fixes

Normal releases require the complete calendar batch. Urgent `hotfix/<target>/...`
PRs additionally declare exactly one `Stage0-Candidate: ...`:

- Beta: `develop/pr-N/<merge-SHA>`, reachable checked Develop source, at least
  24 hours after its merge and successful CI completion.
- Stable: `vX.Y.Z-beta`, certified published signed Beta, at least 168 hours
  after successful publication/build.

Hotfix content must equal the certified source tree, retain the target ancestry,
and satisfy the same regression, exact-head CodeQL, QA, independent approval and
publication authorization checks. Back-sync Main fixes to Beta/Develop and Beta
fixes to Develop via checked PRs. No direct branch push is permitted.

## Deployment and verification

Deploy policy, controllers, workflows and source evidence titles consistently
through checked PRs to Develop, Beta and Main before the first new calendar
rollup. The trusted default-branch controller cannot use a revision that only
exists on Develop. Keep GitHub required-check rules active throughout rollout;
never bypass protections to install the controller.

Run `node --test scripts/remove-nightly-release.test.mjs` plus the existing
release/channel/promotion/publication/regression suites. The protected catalog
also registers the updater's retired-channel isolation contract. Verify native
checks on all supported OSes before promoting this control-plane change.
