# Stage0 agent guidance

Read [feature layout](docs/architecture/feature_layout.md) before adding modules.
For frontend work, consult the [frontend refactor report](docs/architecture/frontend_refactor_analysis.md).
Use the [frontend maintenance map](docs/architecture/frontend_maintenance.md) for
current component, hook and slice ownership. Frontend TypeScript files have an
enforced 450-physical-line limit; aim for 100–300 and review boundaries at 400.
For backend work, consult [backend maintenance](docs/architecture/backend_maintenance.md)
and the measured [refactor report](docs/architecture/backend_refactor_analysis.md).
For Git branching, PR targets and release promotion, follow [Git strategy](docs/architecture/git_strategy.md).

## Git strategy and branching contracts

- **Branch risk and stability hierarchy**:
  - `develop`, `feat/*`, `fix/*` (and other working branches): **Highest risk / least stable** (`unstable`).
  - `nightly`: **High risk** (`preview` daily channel).
  - `beta`: **Medium risk** (`stabilizing` monthly channel).
  - `main`: **Stable** (`low` risk production channel). `main` là bản chính thức có độ ổn định cao nhất; tại một thời điểm `main` có thể không phải là bản có SemVer lớn nhất (do các bản `nightly`/`beta` liên tục tăng theo ngày/tháng), nhưng luôn là bản chính thức đáng tin cậy nhất và là bản `--latest` mặc định cho người dùng.
- **Protected build/integration branches**: `main` (Stable), `beta` (Beta), `nightly` (Nightly), and `develop` (Development) are protected. Never commit or push directly to `main`, `beta`, `nightly`, or `develop`, and never force-push or rewrite their history.
- **Standard work branches off `develop` only**:
  - Always create working branches from `origin/develop` using an approved prefix: `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `perf/<slug>`, `docs/<slug>`, `test/<slug>`, or `chore/<slug>`.
  - When work is complete and verified, push the working branch and open a Pull Request targeting `develop` (`base: develop`).
- **Hotfix exception and mandatory multi-branch sync**:
  - If a hotfix targets `main`, `beta`, or `nightly` directly, branch off that exact branch (`hotfix/<target-branch>/<slug>` from `origin/<target-branch>`) and open the primary PR against `<target-branch>`.
  - Every hotfix MUST be synchronized back to the remaining branches (`main` -> `beta`, `nightly`, `develop`; `beta` -> `nightly`, `develop`; `nightly` -> `develop`) via back-merge or cherry-pick PRs so no fix is lost on subsequent promotions.

## Code organization

- Keep code with its owning feature. Use `common` only for feature-independent reuse.
- Give each file one cohesive responsibility and at most one source owner/type,
  as checked by `pnpm check:architecture`.
- Aim for 300 lines per Rust file. Review boundaries at 400 lines; the enforced
  limit is 500 physical lines, including comments, blank lines and tests.
- Split by behavior: IPC, state, validation, persistence, transport, or a named
  workflow. Keep module roots as stable facades. Avoid catch-all `utils` modules.
- Move tests into sibling test modules when needed; every test file also has the
  same limit. Do not bypass the check with `include!`, minified lines, generated
  files, or size-limit increases. Redesign the boundary instead.
- Use explicit production imports. Tauri IPC facades may use glob re-exports
  because the command macro also generates companion macros.

## Refactor contracts

- Preserve IPC names, serialized fields, events, error behavior, side-effect
  order, locks, transactions, cancellation, resource budgets and platform paths.
- For review changes, preserve the distinction between a recoverable tool error
  and a fatal run error; publication and evidence checks remain authoritative.
- Preserve secret redaction/zeroization, immutable snapshot reads and guardrails
  for both native providers and ACP. See the maintenance guide for ownership.
- Keep structural moves separate from product behavior changes. Retain existing
  tests and move their imports/paths with their owner; never remove assertions
  just to make a refactor pass.

## UI styling contracts

- Buttons with an opaque colored/gray fill must have no border, including hover,
  active, selected and disabled states. Borders are allowed only for transparent,
  white or black/dark neutral backgrounds (`bg-base`, `bg-mantle`, `bg-crust`).
  Use `border-0` for filled buttons; keep keyboard focus outlines separate from
  borders. Use `.btn-solid` for custom/inline opaque fills so the global button
  surface rule applies. Do not apply this rule to inputs or non-button cards.
- Apply small rounded corners (`rounded-sm` / `--radius-sm: 4px`) across UI elements:
  all buttons (`button`), inputs (`input`, `select`, `textarea`), visual containers
  (`div` cards, panels, popovers, dropdowns, modal dialogs, toasts, banners), and badges/tags.
- Preserve existing rounded styling: do not strip or overwrite elements that already
  have explicit rounding (e.g. `rounded-full` for avatars, badges, or circular status dots).
- Keep system window boundaries sharp (`rounded-none` or unrounded):
  - Main application window root frame (`MainLayout.tsx`) and viewport root.
  - Window title bar and Tauri drag region (`TopBarTitleRow.tsx`).
  - Windows-style window controls (Minimize, Maximize, Close in `WindowControls.tsx`
    must use `rounded-none`; macOS traffic lights must use `rounded-full`).
- Diff styling across UI components:
  - Always use solid backgrounds and NO border for diff elements.
  - Deletions / old values: solid red (`bg-red-600 text-white`), no border, no strikethrough unless requested.
  - Additions / new values: solid light green (`bg-emerald-600 text-white`), no border.
  - Keep small rounded corners (`rounded-sm`) and compact padding (`px-1.5 py-0.5`).

## Verification and handoff

- Run `pnpm check:architecture`, relevant Node/Rust tests, and `cargo check
  --manifest-path backend/Cargo.toml`. For broad backend moves run all Rust tests.
- Format changed Rust files using edition 2021; avoid reformatting unrelated files.
- Use `pnpm typecheck` for frontend/IPC changes. Build scripts bump versions;
  use direct checks for verification unless packaging is requested.
- Update the maintenance map when responsibilities move. Report actual checks,
  any remaining failures, and platform coverage accurately.
