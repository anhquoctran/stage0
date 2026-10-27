# Backend maintenance map

The Rust edition is 2021. Feature roots provide stable APIs; child modules own
implementation. See [feature layout](feature_layout.md) for shared ownership and
[the refactor report](backend_refactor_analysis.md) for the measured checkpoint.

## Where code belongs

| Area | Module ownership |
|---|---|
| Software updates | `updates/` owns GitHub-only bounded transport, shared state, signed-version verification and explicit installation. `common/activity/` coordinates installation with review, Git and subprocess/ACP work. Raw plugin IPC stays ungranted. See [software updater](software_updater.md). |
| Application menu | `core/menu.rs` is the stable IPC/event/recent-list facade. `menu/definition.rs` embeds `shared/application-menu.json`; `command.rs`/`node.rs` own its data types, `flags.rs` owns enable/check state, `native.rs` renders the macOS tree, `keymap.rs` validates native accelerator/display metadata, and `runtime_state.rs` caches flags/keymaps per window and updates the focused native menu. The window manager remains authoritative for repository presence; destroy events discard both caches. Native accelerators are installed only after frontend hydration, never from stale defaults. Tests validate platform configuration parity without claiming execution on those OSes. |
| Linux window chrome | `core/desktop/` detects GNOME/KDE Plasma/Xfce and reads bounded, read-only desktop settings. `get_window_chrome` exposes frame/button/action metadata; `window_manager/startup_window.rs` applies the saved System/Custom selection during the hidden handoff and restores native GTK controls inside Tao's empty Wayland splash title bar on the main thread. See [Linux desktop contract](linux_desktop_windows.md). |
| Linux development identity | `core/desktop/dev_desktop.rs` sets the dev-only Wayland program name before GTK initialization and registers the matching user-local desktop entry and official Dock icon. Production desktop entries, application data paths and single-instance routing are unchanged. See [Linux desktop contract](linux_desktop_windows.md#development-dock-icon). |
| Linux tray availability | `core/tray/linux_host.rs` checks the actual GDK backend and StatusNotifier watcher/host before tray creation. On Wayland without a host, tray setup returns an unsupported error to its existing best-effort caller, avoiding libappindicator's invalid X11 GtkStatusIcon fallback. D-Bus calls have 500ms timeouts and do not activate services; X11 retains legacy tray support. |
| macOS window chrome | `tauri.macos.conf.json` positions the primary window's native traffic lights; dynamically created native windows use the matching logical inset in `core/window_manager.rs`. Keep the positions synchronized and retain `titleBarStyle: Overlay` with decorations enabled. |
| Keymaps | `core/keymaps.rs` is the validation facade. `keymaps/catalog.rs` resolves the shared menu/preset metadata; `shortcut.rs` normalizes the bounded portable syntax; `validation.rs` checks preference records, protected system bindings and same/prefix conflicts across all three platform configurations. `preferences/schema.rs` calls this validator for optional `keymap` data, preserving older files without that section. |
| JSONC preferences | `preferences.rs` is the facade. `manager.rs` owns read/save/patch/reset and lock lifetimes; `storage.rs` owns secure filesystem operations; `jsonc_patch.rs` preserves CST formatting; `migration.rs` sanitizes legacy settings. |
| Preference validation | `validation.rs` parses and bounds JSONC; `schema.rs` validates sections; `validation_fields.rs` supplies typed field checks; `validation_records.rs` validates MCP/reviewer records; `secrets.rs` rejects credential material. `runtime_config.rs` validates/applies runtime selections. |
| System integration | `preferences/system_integration.rs` applies startup and Explorer options. `system_integration/cli_path.rs` dispatches the per-user `stage0` PATH setup; Unix shell profile blocks/launcher scripts and Windows user PATH registry/PowerShell shims live in its platform children. Removing the option removes only Stage0-marked files/entries. |
| System fonts | `preferences/fonts.rs` owns the read-only `list_system_font_families` IPC. `font-kit` enumerates installed families through Core Text, DirectWrite or Fontconfig on a blocking worker. Only sorted/deduplicated public family names are returned, never font files or paths. Linux builds need Fontconfig and FreeType development libraries. Do not replace native enumeration with guessed platform font names. |
| AI preference transaction | `ai/preferences.rs` coordinates keychain and runtime application; its tests cover rollback. This is distinct from JSONC disk storage. |
| Git IPC | `git/commands.rs` re-exports `repository`, `clone`, `clone_credentials`, `history`, `sync`, `refs`, `settings`, and `external_apps`. Keep command wrappers thin. |
| Git operations | `git/ops.rs` re-exports `sync`, `remotes`, `refs`, `history`, and `remote_url`. `ref_validation.rs` validates configured names and refs. Process bounds remain in the shared runner. |
| Review lifecycle | `review/runtime.rs` owns adapter lifecycle, cancellation/deadline, final persistence and coordinator release. `runtime/engine.rs` owns bounded model turns and recovery. `runtime/initial_context.rs` prepares initial grouped diffs in the user context, measures the encoded adapter request against existing request/wire budgets, and commits initial delivery coverage only after a successful model response. Reply-only runs receive no bulk source. |
| Review tools | `tool_turn.rs` validates calls and coordinates each turn; `action_dispatch.rs` executes supported actions; `submission.rs` validates the verdict and publishes staged actions; `tool_state.rs` holds per-run staging state. `review_actions.rs` holds supporting domain operations. |
| Review input security | `review/input_screen.rs` emits advisory signals without changing text; `discussion_revision.rs` fingerprints the exact thread. `runtime/prompt.rs` keeps preferences outside privileged prompts; `scope.rs` binds reply capabilities; `discussions.rs` owns bounded root/history delivery; `discussion_observation.rs` tracks actual delivered body coverage; `audit.rs` records output signal metadata. Native and ACP share these guards. Resolution additionally requires changed current-head evidence; publication rechecks revisions transactionally. See [review input trust](review_prompt_injection.md). |
| Review source context | `review/context.rs` holds captured state. `snapshot.rs` captures object IDs and reads Git; `blob.rs` reads regular blobs; `diff.rs` shares full-blob secret filtering and bounded diff caching between legacy per-file reads and grouped delivery. `diff_batch.rs` packs directory-local files into bounded packets, splits oversized files with explicit diff offsets/source counters, and commits only contiguous delivered coverage. `tools.rs` retains the existing per-file pagination/output/coverage contracts and exposes `get_diff_batch`; `evidence.rs` verifies findings and reverts. |
| Review discussion excerpts | `review/context/discussion_snippet.rs` captures a bounded, side-specific excerpt from the original immutable review objects, redacting the full blob before slicing and identifying actual changed lines. `review/discussion_snippets.rs` reconstructs missing snippets for published AI discussions during the blocking `list_mr_discussions` workflow and caches them in the existing `code_snippet` column after rechecking anchors. Recovery is bounded, checks the current source-path policy, supports older findings, and never changes anchors, coverage, discussion revisions or review authorization. Unavailable original objects leave an explicit unavailable state. |
| Provider protocol | `review/provider.rs` re-exports endpoint policy, message encoding, bounded HTTP transport, and response decoding. Model adapters remain the bridge to the runtime. |
| ACP | `ai/acp.rs` is the facade. Registry commands/icons, launch configuration, process transport, account data, ordinary prompts and isolated review sessions have separate modules. Existing binary archive/install modules remain independent. |
| Credentials | `credentials/mod.rs` is the facade. `scan.rs` schedules refresh; `discovery.rs` enumerates metadata; `helper_lookup.rs` reads helpers; `remote_identity.rs` normalizes identity; `clone_auth.rs` handles origin-scoped clone credentials; `vault.rs` accesses the OS keychain. |
| SQLite | `core/db/mod.rs` owns initialization/access and holds the storage lock for the connection lifetime. `storage.rs` opens ordinary bundled SQLite without a password or OS-vault access, secures files, rejects database/sidecar symlinks, locks the location and migrates legacy filenames. Unreadable encrypted/corrupt files are retained with a reset instruction. `migrations.rs` upgrades schema/data; `settings.rs` performs generic settings queries. Feature queries stay under feature persistence. See [database storage](database_storage.md). |
| Virtual MR persistence | `virtual_mr/persistence.rs` owns sessions and metadata transactions; `persistence/discussions.rs` owns discussions, comments and anchors. Record types remain individual files. |
| Guardrails | `guardrails_engine.rs` owns policy state. Child modules own read policy, command policy, audit/output bounds and simulation. Sandbox tool schemas are in `tool_bridge/schemas.rs`. |

## Contracts that structural changes must preserve

1. **IPC:** command names, arguments, result shapes, serde naming and event kinds
   are consumed by frontend/native callers. Tauri's command attribute generates
   companion macros (`__cmd__*` and command-name macros). A facade must re-export
   those too; use command-module glob exports and compile the real registration.
2. **Preferences:** process/local locks cover the same operations; revision
   checks prevent stale writes; backups and recovery remain intact. Atomic file
   replacement, private permissions, symlink rejection, JSONC comments/unknown
   fields and credential separation must survive a move.
3. **Database:** keep the same connection guards, transaction boundaries,
   migration order and parameterized SQL. Session/reviewer/label changes remain
   atomic, including the unique open-MR branch-pair rule.
4. **Review:** the captured Git objects are authoritative. Pagination contributes
   coverage only after a result passes limits and is delivered. Evidence and
   approval checks still gate publication. The first-stage description update
   requires all eligible diff pages. Event names such as `description_updated`
   are stable. Keep run errors and recoverable tool errors distinct: the outer
   `dispatch_action` result aborts the run; the inner error reaches the model.
5. **ACP:** retain isolated review working directories, filtered/redacted inputs,
   rejection of workspace/tool requests, bounded output, cleanup and child-process
   termination. The review engine applies the same policies to both adapters.
6. **Credentials/Git:** retain zeroization, one-time credential cleanup, origin
   matching, subprocess bounds, URL/ref validation, progress, operation leases,
   and cancellation. Keep `cfg` branches for each supported platform.
7. **Menu:** command IDs and `menu-action` payloads remain stable. The shared JSON
   owns labels/order/accelerators/conditions; do not add another hard-coded tree.
   Standard macOS editing/services/window roles stay native. `update_application_menu_state`
   is window-scoped UI metadata, not authority for Git actions; actual operations
   retain their backend validation. Recheck fresh frontend state at dispatch too.

## Size and dependency rules

Aim for 300 lines in a Rust file. At 400, identify the next cohesive boundary
before extending it. `pnpm check:architecture` enforces 500 physical lines for
every application `.rs` file and `backend/build.rs`, including tests. Vendored
code and generated build output are outside the application tree. There are no
per-file exceptions. The same check enforces the existing source-owner rule.

Split by responsibility and the state it owns. A state machine can stay together
when its steps share one lifecycle; the review engine is an example. Keep tool
actions and transport outside it. Avoid arbitrary numbered chunks, empty layers,
`include!` workarounds, compressed formatting and generic utility dumping grounds.
Keep types narrow and imports explicit; use feature facades across boundaries.

## Refactor workflow

- Establish a passing baseline and identify public callers before moving code.
- Move cohesive groups with their tests. Change only imports/visibility needed
  by the new module tree. Preserve code order and failure behavior.
- Format changed Rust files with edition 2021. Run `cargo check` to verify Tauri
  registration as well as ordinary Rust name resolution.
- Run focused tests while extracting, then `cargo test --manifest-path
  backend/Cargo.toml --lib` after broad changes. Run `pnpm test`,
  `pnpm check:architecture`, and `pnpm typecheck` for the final checkpoint.
- Prefer behavior tests that exercise boundaries. When a test inspects a source
  literal, follow the owning module after a move and retain its assertions.
- Refresh this ownership map and the report. Report which platform was checked;
  local macOS execution does not verify Windows/Linux native behavior.

The size check is part of the Node test suite and production build preflight.
Build preflight runs before the existing version bump. Use direct verification
commands when no new release/version is intended.
