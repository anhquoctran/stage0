# Git Strategy, Git Flow & Branching Policy

Stage0 enforces a strict multi-channel Git Flow so automated agents and human
contributors never mutate build/release branches directly and every change flows
predictably from integration (`develop`) through preview channels (`nightly`,
`beta`) to production (`main`).

## 1. Protected Long-Lived Branches & Risk Hierarchy

| Branch / Tier | Risk Level | Stability | Role | Direct Commit / Push | Release Cadence (UTC) | Version Format |
|---|---|---|---|---|---|---|
| `feat/*`, `fix/*`, `refactor/*`, `origin/develop` | **Highest (`highest`)** | Least stable (`unstable`) | Active feature/bugfix work & primary integration branch | **Forbidden on `develop`** (PR only) | Continuous integration | Unreleased working tree |
| `origin/nightly` | **High (`high`)** | Preview (`preview`) | Nightly build channel (promoted from `develop`) | **Forbidden** (PR only) | Daily at `00:00 UTC` (build starts `23:00 UTC`) | `0.0.x-nightly` |
| `origin/beta` | **Medium (`medium`)** | Stabilizing (`stabilizing`) | Beta build channel (monthly rollup of eligible `nightly` builds) | **Forbidden** (PR only) | Monthly on the 27th (period closes at `00:00 UTC`; approve/build/publish afterwards) | `0.0.x-beta` |
| `origin/main` | **Low (`low`)** | **Stable (`stable`)** | Production release channel (quarterly rollup of eligible `beta` builds) | **Forbidden** (PR only) | Quarterly on `01/01`, `01/04`, `01/07`, `01/10` (period closes at `00:00 UTC`; approve/build/publish afterwards) | `0.0.x` |

- **Risk progression (`develop`/`feat`/`fix` [Highest] → `nightly` [High] → `beta` [Medium] → `main` [Stable])**:
  - Code promotions always flow from higher-risk branches toward lower-risk branches only after verification gates pass.
  - Never merge a higher-risk branch into a lower-risk branch during a hotfix sync (which would leak unstable code into a more stable tier); hotfix synchronization always flows from the lower-risk branch back toward higher-risk branches (`main` → `beta` → `nightly` → `develop`).
- **SemVer vs. Production Stability**:
  - `main` là bản phát hành chính thức (official production release) có **độ ổn định cao nhất** và mức độ rủi ro thấp nhất (`low risk / stable`).
  - **`main` có thể không phải là bản có SemVer lớn nhất tại một thời điểm**: Trong khi `main` giữ nguyên phiên bản ổn định giữa các kỳ release theo quý, các kênh `nightly` (hàng ngày) và `beta` (hàng tháng) liên tục phát hành các bản xem trước với số SemVer tăng dần (`0.0.x-nightly`, `0.0.x-beta`).
  - Dù vậy, vai trò chính thức của `main` là tối thượng:
    - Bản phát hành từ `main` luôn là bản `--latest` chính thức trên GitHub Releases (`prerelease=false`).
    - Website chính thức và hero download luôn ưu tiên tải bản Stable từ `main`.
    - Trình cập nhật ứng dụng (`updater`) phân tách channel riêng biệt (`channel-stable`), người dùng bản chính thức không bao giờ bị cập nhật nhầm sang các bản xem trước dù số SemVer của preview cao hơn.
- **No direct commits or pushes** are permitted on `main`, `beta`, `nightly`, or `develop`.
- **No force-pushes (`--force` / `--force-with-lease`)** or history rewrites on any protected branch.
- Canonical branch, risk and channel metadata is defined in `shared/release-channels.json` and validated by `validateGitFlowBranch` and `branchRiskProfile` in `scripts/release-channels.mjs`.

### Calendar release accumulation

Beta accumulates all eligible published Nightly snapshots from day 28 of the
previous month through the end of day 26. Stable accumulates eligible Beta
snapshots from the entire previous calendar quarter. UTC windows are half-open;
planning begins only after cutoff at 00:00 on day 27 or quarter day 1, and
publication follows approval and the complete signed build on that UTC day.

The ledger records every build proof and unique source commit; fixes/reverts and
independent source changes are accumulated without guessing stability from age.
CodeQL, human QA/readiness review and approval of the exact assembled head remain
mandatory. See the [release promotion runbook](release_promotion.md) for cutoff
examples, failure handling, hotfix certification and ruleset rollout.
`promotion/beta/YYYY-MM-DD` and `promotion/stable/YYYY-MM-DD` are automation-only
frozen assembly refs, an explicit exception to ordinary work branches from develop.
They must never be amended or conflict-resolved in place.

### Preview activity gate and per-release changelog

- Nightly only builds when its own source branch has at least one
  commit not included in the last **published release of the same channel**,
  with a committer timestamp inside the inclusive UTC interval `[now - 24h, now]`.
  `previewActivityHours` in the shared policy owns the window. Merge commits count
  as new integration work; generated release preparation commits do not count.
- Check before allocating a scheduled version/tag and again at the tag workflow's
  preparation job, before validation or the build matrix. The second check also
  applies to manual tag dispatches, pushed preview tags and delayed retries. An
  already published preview tag is skipped. Skips record their reason in the
  Actions summary; eligible channels still run when another due channel is idle.
- Beta and Stable use the full monthly/quarterly accumulation period, not the
  rolling 24-hour activity gate. No eligible new source content means no release
  tag/build. The former 24h/7-day candidate observation rules do not govern these
  calendar rollups.
- The baseline comes from the paginated GitHub Releases API, using publication
  time. Draft releases, failed/unpublished tags and channel feed aliases are not
  baselines. API or Git history failures fail preparation instead of assuming an
  empty release history. Checkouts used for changelog generation fetch full history.
- `scripts/release-history.mjs` resolves generated snapshots to their source parent
  because release commits are detached siblings of source branches. Its source
  ranges drive both activity checks and changelog generation.
- `scripts/release-changelog.mjs` lists only commits introduced since the previous
  published source snapshot, with commit/comparison links. Commit subjects are
  escaped as literal Markdown. The first release of a channel explicitly lists
  its source history; an unchanged manual Stable release explicitly says there
  are no source changes. Fixed feature lists are not copied into new releases.
- Freeze the baseline in tag preparation and pass it to both bundle generation
  and publication. `RELEASE_NOTES.md`, the embedded About release notes and the
  GitHub Release body use the same generated text. Draft retries refresh that body.
- Promote this workflow and its helper scripts together through `nightly`, `beta`
  and `main`: the scheduled controller runs on `main`, while isolated builds run
  the workflow stored at the selected channel tag.

---

## 2. Standard Development Flow (Feature / Fix / Refactor / Chore)

All standard development **must** branch off `origin/develop` and merge back
into `develop` via Pull Request.

### One worktree, sequential task branches

Use only `/Users/anhquoctran/Workspaces/stage0`. Do not create additional
worktrees or temporary checkouts for features, fixes, reviews or parallel tasks.
Before changing tasks, inspect staged, unstaged and untracked changes and commit
the current work on its working branch. Preserve unfinished work; do not discard
it or leave it in a second checkout. If changes are currently on a protected
branch, move them onto an appropriate working branch before committing.

For each new standard task, fetch `origin`, create a new branch from
`origin/develop` with an approved prefix, and switch to it in this same directory.
Keep existing branches and commits available when switching tasks. Hotfixes still
use the release-branch bases and back-sync requirements in section 3.

```mermaid
flowchart LR
    DEV["origin/develop"] -->|"git checkout -b feat/..."| WORK["Working Branch (feat/*, fix/*, refactor/*, ...)"]
    WORK -->|"Verify + Push + Open PR"| PR["Pull Request -> develop"]
    PR -->|"Merge after checks"| DEV
    DEV -->|"Promote"| NIGHTLY["origin/nightly (Daily 00:00 UTC)"]
    NIGHTLY -->|"Promote"| BETA["origin/beta (Monthly 27th 00:00 UTC)"]
    BETA -->|"Promote"| MAIN["origin/main (Quarterly 1st 00:00 UTC)"]
```

### Naming Conventions for Standard Branches
- `feat/<short-slug>` — New features or user-facing capabilities
- `fix/<short-slug>` — Bug fixes targeting `develop`
- `refactor/<short-slug>` — Structural refactoring without product behavior changes
- `perf/<short-slug>` — Performance improvements
- `docs/<short-slug>` — Documentation updates
- `test/<short-slug>` — Test additions or harness improvements
- `chore/<short-slug>` — Build scripts, CI, or dependency maintenance

### Mandatory Steps for Agents
1. **Sync & branch off `origin/develop`**:
   ```bash
   git fetch origin develop
   git checkout -b feat/<short-slug> origin/develop
   ```
2. **Implement & verify locally**:
   - Run `pnpm check:architecture`, `pnpm typecheck`, relevant Node/Rust tests, and `cargo check --manifest-path backend/Cargo.toml`.
3. **Push working branch & open a PR targeting `develop`**:
   ```bash
   git push -u origin feat/<short-slug>
   gh pr create --base develop --head feat/<short-slug>
   ```

---

## 3. Hotfix Exception & Mandatory Multi-Branch Synchronization

When an urgent bug must be fixed directly on an active release branch (`main`,
`beta`, or `nightly`) without waiting for full `develop` promotion:

```mermaid
flowchart TD
    TARGET["Target Release Branch (main | beta | nightly)"] -->|"git checkout -b hotfix/<target>/<slug>"| HF["Hotfix Branch"]
    HF -->|"1. Primary PR"| TARGET
    HF -->|"2. Mandatory Back-Sync PRs"| SYNC["Remaining Protected Branches"]
    SYNC --> B_BETA["origin/beta (if hotfix on main)"]
    SYNC --> B_NIGHTLY["origin/nightly (if hotfix on main or beta)"]
    SYNC --> B_DEV["origin/develop (always required)"]
```

### Hotfix Rules
1. **Branch directly from the affected release branch** (`origin/main`, `origin/beta`, or `origin/nightly`):
   ```bash
   git fetch origin <target-branch>
   git checkout -b hotfix/<target-branch>/<short-slug> origin/<target-branch>
   ```
2. **Open the primary PR targeting `<target-branch>`** (`main`, `beta`, or `nightly`).
3. **Synchronize the hotfix back to all downstream/remaining branches** (`policy.gitFlow.syncTargets`):
   - **Hotfix on `main`** → Must sync to **`beta`**, **`nightly`**, and **`develop`**.
   - **Hotfix on `beta`** → Must sync to **`nightly`** and **`develop`** (and `main` if the defect also exists in production).
   - **Hotfix on `nightly`** → Must sync to **`develop`**.
   - If the target branch contains unpromoted commits that should not move into another channel yet, open a cherry-pick PR (`hotfix/sync-<branch>/<short-slug>`) from each remaining branch with `git cherry-pick -x <hotfix-commit>` so only the hotfix is synchronized.
