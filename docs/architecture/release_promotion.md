# Release promotion: Nightly → Beta → Stable

Only adjacent promotion is allowed: **published Nightly → Beta** and
**published Beta → Stable (`main`)**. A branch name, a green unrelated CI run,
or an arbitrary tag is not release evidence. The candidate is an immutable
published tag and its recorded source commit, not the current moving channel head.

## Required gates

| Gate | Nightly → Beta | Beta → Stable |
| --- | --- | --- |
| Published candidate | `vX.Y.Z-nightly` | `vX.Y.Z-beta` |
| Minimum observation | 24 hours | 168 hours (7 days) |
| Original release evidence | Exact tag/SHA, successful validation, all six native build targets and publication | Same |
| Packages | All eleven bundles, nine updater signatures, manifest and checksums; uploaded/nonempty, no replacement after successful build | Same |
| Security | Successful CodeQL Actions/JS/Rust analysis on exact PR head; no candidate High/Critical alerts; API errors block | Same |
| Integration | Target is an ancestor; exact tested source tree, no conflicts or extra changes | Same |
| Human decision | Smoke-test/readiness checklist and one human approval of the exact head | Same |
| Merge | PR only; **Create a merge commit**, no squash/rebase | Same |
| Publication | Rebuild, sign and verify every package for the new version | Same |

Observation begins at the later of the candidate's publication and completion
of its successful release workflow. Editing notes does not reset it. Replacing
assets after that run invalidates the candidate; publish a new version. The
original release pipeline verifies package bytes/signatures with the embedded
public key; promotion checks its successful complete run and asset timestamps,
not merely a release title or a signature file's presence.

`shared/release-channels.json` owns the routes, observation hours and required
status context. Changing this policy itself goes through normal reviewed code.
There is no workflow input to waive gates or shorten observation for one run.

## Operator procedure

1. Merge desired changes through `develop` to `nightly` using PRs. Back-sync any
   target-branch commits first, including previous promotion merge commits, so
   the target is an ancestor of the candidate. Build/publish Nightly normally.
2. Test the exact published installers/updater on supported OS/architectures.
   Check launch, file diff/encoding, reviewer operation, upgrade path and known
   regressions. Wait at least 24 hours after successful publication/build.
3. In Actions, run **Promote tested release** on **main** with target `beta` and
   the exact `vX.Y.Z-nightly` tag. It creates a frozen
   `promotion/beta/<tag>` branch and a PR to `beta`. This automation-only branch
   is an explicit exception to standard working branches from `develop`: it
   points directly at the tested source commit and must never be amended.
4. **Close and reopen the bot-authored PR once as the maintainer.** This human
   event activates GitHub default CodeQL setup: PR events created with
   GITHUB_TOKEN do not trigger other workflows. Wait for Actions/JS/Rust CodeQL
   analyses, then complete both checklist boxes in the PR. **Release promotion policy** checks
   the candidate and merge tree; an unchecked box keeps it failed. Approve the
   exact head, resolve review threads and use **Create a merge commit**. The bot
   authors the PR so the single repository maintainer can independently approve
   it; the workflow never submits approval or merges it.
5. The normal Beta schedule publishes only that approved promotion merge.
   The existing 24-hour preview-activity rule still applies: merge close to the
   scheduled build window (monthly on the 27th, preparation on the 26th at
   23:00 UTC). An idle/unapproved Beta is not rebuilt. Merge does not immediately
   publish a release.
6. Test the published Beta and observe it for 7 days. Run the same promotion
   workflow with target `stable` and the exact `vX.Y.Z-beta` tag. Review/approve
   its frozen PR into `main`. The quarterly schedule or manual **Release Stage0**
   on `main` then publishes Stable. Stable remains the default `--latest` release.

A conflict, moved candidate branch, target branch change or additional fix
requires back-syncing the target, rebuilding the preceding channel and selecting
a new candidate. Never resolve conflicts directly inside the frozen promotion
PR. Strict up-to-date status requirements close the gap if the target advances
after validation. Squash/rebase merges are rejected again at publication.

A cancelled/failed validation can be rerun from Actions using **Release promotion
guard** on `main`, input `pr`. Bot-created PRs are explicitly dispatched to this
workflow because GITHUB_TOKEN-created PRs do not trigger another PR workflow.
That dispatch runs the policy validator only; it does not trigger default CodeQL.
The maintainer close/reopen step above is mandatory to start those analyses.
This retains bot authorship (so the owner can approve) without introducing a
privileged personal token or a second, conflicting CodeQL setup.
PR edits/pushes normally revalidate automatically. If CodeQL is still running,
wait for all three analyses and rerun the guard on `main`. Analyses from an old
head or another branch do not satisfy this gate; unresolved alerts on an unrelated
old `main` snapshot do not prevent promoting the candidate that fixes them. No candidate code runs in
`pull_request_target`; checkout stays on the trusted base/controller SHA and
candidate commits are read only as Git objects. The status is explicitly posted
on the PR head because `pull_request_target` itself runs against the base SHA.

## Release guard and audit trail

Scheduled preparation, manual preparation, tag dispatch and final publication
all call the same promotion validator. It requires the source to be the merge
commit of a merged PR targeting the correct channel, a human approval matching
its head and a successful bot policy status before merge. It recomputes the
candidate/merge trees, original release evidence, age and CodeQL analyses/alerts scoped to the exact commit. PR validation scans
the PR head; after merge, publication requires successful fresh analyses of the
current target-branch merge commit (whose tree must equal the candidate). This
also avoids relying on temporary PR analysis retention. If those scans are still
running, preparation blocks until they finish.
The source must still be the current target-channel head; a newer promotion
invalidates an older in-flight build. Final publication rechecks after any wait
for the release window. A successful
past check cannot authorize a changed source or replaced asset.

The PR records candidate tag, source SHA, build URL, test acknowledgement and
approval; Actions summaries record the decision. Release tags are detached
version/changelog snapshots with one source parent and an explicit
`Stage0-Source-Commit` trailer. Snapshot changes outside the generated release
metadata allowlist are rejected. Existing legacy releases without that trailer
remain downloadable but cannot become promotion candidates. Create a fresh
Nightly after rollout.

Urgent hotfix branches still originate at and target the affected release branch,
with mandatory back-sync PRs to the remaining branches. A hotfix PR into Beta or
Stable must declare exactly one line `Stage0-Candidate: vX.Y.Z-nightly` or
`Stage0-Candidate: vX.Y.Z-beta`, respectively, and use the same two checklist
lines generated by promotion PRs. Its complete tree must equal that published
lower-channel candidate, with the same tests, observation, approval and merge
requirements. A hotfix branch name is not a release-gate bypass. Incorporate and
certify the fix through the preceding channel before publishing it.

## Deployment and server-side enforcement

Workflow files in a feature PR do not change live branch protection. Deploy this
policy before requiring its status; otherwise there is no workflow to satisfy
it. Keep the existing `main` ruleset and CodeQL rules; add the two dedicated
Stage0 rulesets rather than replacing existing protection.

1. Merge the implementation PR to `develop`. Through explicitly reviewed policy
   rollout PRs, copy this exact enforcement implementation to `nightly`, `beta`
   and `main` before enabling the new required check. This is a one-time control
   plane bootstrap, not authorization to publish an uncertified build. Existing
   release versions lack provenance and must not be promoted as a shortcut.
2. Under Settings → Actions → General, enable **Allow GitHub Actions to create
   and approve pull requests**. It allows the bot to create the PR; the code
   does not approve. Keep automatic deletion of head branches **disabled** to
   preserve the long-lived channel branches.
3. From the merged implementation, run `node scripts/configure-release-protection.mjs`.
   It is a read-only preflight showing missing files/settings and the proposed
   rulesets. All twelve enforcement files must match byte-for-byte on all four
   protected branches. Resolve every issue first.
4. Run `node scripts/configure-release-protection.mjs --apply` with repository
   administration permissions. It checks all prerequisites before any writes,
   then idempotently creates/updates only its own named rulesets:
   - All four long-lived branches: PR required, deletion/force-push forbidden,
     review threads resolved; ordinary integration retains its merge methods.
   - Beta/main: one approval, stale approvals dismissed, latest push independently
     approved, required **Release promotion policy** from GitHub Actions, CodeQL
     High/Critical findings and analysis errors blocked, branch
     must be up to date, **no bypass actors** (including administrators).
5. Publish a fresh Nightly, complete the observation/tests, and exercise the
   first Beta promotion. Inspect the successful policy status on the PR head.
   Release schedules remain unchanged.

The preflight fails closed before mutation if rollout or bot PR permissions are
missing. It does not weaken another ruleset, grant credentials, change repository
Actions settings or merge any PR. GitHub administrators can always edit repository
configuration; emergency policy changes must be explicit and audited rather than
using an everyday workflow bypass input.
