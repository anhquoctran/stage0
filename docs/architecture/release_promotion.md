# Calendar release rollups: Nightly → Beta → Stable

Regular releases accumulate the whole closed period, rather than promoting one
arbitrarily selected tag. UTC remains the release timezone.

| Target | Eligible published source builds | Closed period | Planning starts |
| --- | --- | --- | --- |
| Beta | Nightly | Day 28 of the previous month through the end of day 26 of the release month | Day 27, 00:00 UTC |
| Stable (`main`) | Beta | The entire previous calendar quarter | January/April/July/October 1, 00:00 UTC |

Windows are half-open: `[start, cutoff)`. Beta on 2026-11-27 includes Nightly
releases published from 2026-10-28 00:00 through 2026-11-26 23:59:59.999 UTC.
Stable on 2027-01-01 includes Beta releases from 2026-10-01 00:00 through
2026-12-31 23:59:59.999 UTC, including the December 27 Beta.

The window classifies **published source builds**, not arbitrary commit dates.
Snapshots already contain their dependencies/history. A late commit that has not
appeared in an eligible published source build cannot be called tested/stable;
it waits for a later eligible source build/period. Day-27 Nightlies are outside
that month's Beta window, but subsequent snapshots retain their cumulative work.

## Stability and selection

CI cannot infer which feature is the most stable. The controller inventories all
published builds in the period and accepts those with complete, successful
release evidence: exact immutable tag/SHA, validation, all six native build
platforms, publication, eleven bundles, nine updater signatures, manifest and
checksums. A newer failed/pending attempt, replaced/missing asset or invalid
source provenance rejects the source build, with its reason recorded for review.
API/auth/history failures abort the whole plan; they do not silently drop builds.
Drafts, unpublished/failed tags and channel aliases are not source releases.

Every eligible source snapshot is accumulated, in publication order, into the
current target branch. This includes stable fixes from independent snapshots,
not merely the last tag. Shared commits are deduplicated through Git ancestry;
subsequent fixes/reverts retain their effects. The immutable ledger at
`.github/release-rollup.json` records the window, base SHA, all source tags/SHAs,
original build runs, rejected builds and the complete unique introduced commit
list. Existing target changes are retained. A period with no eligible build or
no new source content creates no PR, tag or build.

The final assembled batch must pass CodeQL Actions/JavaScript/Rust at its exact
PR head, without High/Critical findings, and be explicitly accepted by a human
who reviews the commit list, known regressions and smoke-test results. Green
source builds alone do not approve a batch. The full newly assembled source is
rebuilt on all six targets, signed and cryptographically verified before release.
A rejected/failed batch is not published merely to meet the calendar deadline.

Application conflicts stop the plan; no automatic ours/theirs resolution is
allowed. Fix/revert unstable work in the source channel and publish a corrected
eligible source build, then regenerate the period. Do not hand-edit the frozen
head or remove commits without reassembling/retesting it. A known regression
inherited by a later green build still requires an actual fix/revert and QA;
ignoring the older build's tag does not remove its inherited code.

Only the reserved ledger data path is normalized between channels while merging.
A Beta ledger must not conflict with the previous Stable ledger as if it were
application code. Original source histories remain reachable. Assembly commits
are explicitly marked metadata and are omitted from product changelogs; actual
source fixes/reverts remain in the normal same-channel release delta.

## Operator and workflow procedure

1. Merge work through `develop` → `nightly` using PRs. Nightly retains its daily
   schedule and 24-hour new-source activity rule.
2. **Accumulate periodic releases** runs on `main` at the cutoff (Beta day 27;
   Stable quarter day 1). It opens a bot-authored frozen branch/PR such as
   `promotion/beta/2026-11-27` → `beta`, or
   `promotion/stable/2027-01-01` → `main`. It can also be dispatched manually
   with channel and ISO release date to retry a closed period.
3. Close and reopen the bot-authored PR once as the maintainer to trigger default
   CodeQL. GITHUB_TOKEN-created PR events do not trigger other workflows. The
   controller explicitly dispatches the policy workflow, but that dispatch alone
   cannot start GitHub's default CodeQL analyses. No personal bot token is needed.
4. Review every source build, commit/fix and rejected-build reason. Wait for
   CodeQL, test the source builds and complete both QA/readiness checkboxes.
   Approve the exact head and **Create a merge commit** on the scheduled UTC day.
   The bot authors the PR so the single maintainer can independently approve.
   The workflow never approves or merges a PR itself.
5. **Build approved periodic rollup** reacts to the merge push on `beta`/`main`.
   It uses the trusted `main` controller and waits up to 20 minutes for CodeQL
   analyses of that exact merge commit. Other policy/security failures stop
   immediately. It prepares only this channel's immutable version tag and
   dispatches the existing isolated tag build/signature-verification pipeline.
   It can be rerun manually on `beta`/`main` after transient failures.
6. The release is published after approval/build/checks finish on day 27 or the
   quarter's first day; midnight is the cutoff/start, not a promised instant of
   publication. A missed day fails closed rather than silently publishing an old
   period later. Stable remains the default `--latest` release.

A target advance invalidates the frozen base/head. Close the superseded PR and
remove only its working branch before regenerating; never force-push an approved
batch. Repeated creation of an identical plan reuses its existing PR. A source
already published for the period is not rebuilt. Conflicts and changed source
build evidence likewise require regeneration and a new review.

The old **24-hour Nightly observation / 7-day Beta observation** does not govern
calendar rollups: it would exclude the final Nightly fixes and December 27 Beta
from the requested releases. Beta also no longer needs a new commit within the
last 24 hours: unreleased changes anywhere in the monthly period count. Normal
Beta/Stable paths require a full period ledger, so an old single-tag promotion
or raw tag cannot bypass accumulation. Explicit certified hotfixes retain their
separate adjacent-candidate observation and back-sync contracts.

## Verification and audit

PR validation recomputes the period inventory, original source-build proofs,
unique commit list, deterministic assembly objects and exact head SHA. It also
checks target ancestry, QA and current PR-head CodeQL. At publication, the source
must be the approved PR merge commit and the current target-channel head, with a
human approval of that exact PR head and a successful bot policy status before
merge. The merged tree must equal the assembled head. Current target-commit
CodeQL is rechecked after merge and before publication. Superseded builds, expired
periods, changed assets and altered ledgers cannot publish via a manual/tag retry.

Candidate sources are Git objects only: no checkout or execution of their scripts
in the trusted controller. Assembly uses an isolated temporary **Git index**, not
another worktree. All feature work still uses the repository's single checkout.
Native builds run only in their immutable tag cache/security scope. Release tags
retain one source parent and explicit `Stage0-Source-Commit` provenance. Legacy
releases without that provenance cannot supply a rollup until rebuilt correctly.

Urgent hotfixes still originate at their exact release branch and back-sync via
PRs. They use `hotfix/<target>/<slug>` (or `hotfix/sync-<target>/<slug>`), declare
one `Stage0-Candidate: vX.Y.Z-nightly` for Beta or `...-beta` for Stable and retain
the existing candidate observation, exact-content, QA, approval and merge gates.
They do not become a normal monthly/quarterly batch or bypass verification.

## Deployment and enforcement

Deploy this controller/workflow revision consistently to `develop`, `nightly`,
`beta` and `main` through reviewed policy rollout PRs. Keep existing `main`
security rules and the baseline PR/no-force-push/no-deletion rules intact.
Enable Settings → Actions → General → **Allow GitHub Actions to create and
approve pull requests** for bot PR creation; the code never submits approval.
Keep automatic deletion of head branches disabled for long-lived branches.

Run `node scripts/configure-release-protection.mjs` for read-only preflight.
It lists every missing/different enforcement file and setting. After rollout,
run it with `--apply` using repository administration permissions. It checks all
files byte-for-byte on all four branches before any writes, then updates only
its own named rulesets. Beta/main require a current passing promotion status
from GitHub Actions, one human approval, stale-review dismissal, last-push
approval, resolved threads, merge commits only and no bypass actors; CodeQL
High/Critical findings and analysis errors block. Other integration branches
retain their ordinary merge methods.

Workflow files in an unmerged implementation PR do not activate this policy.
Do not install an unsatisfiable required check before its workflows are deployed.
No release branch is automatically merged by the rollout or by this implementation.
