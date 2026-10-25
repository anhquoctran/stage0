# Feature layout

Both application sources use `common`, `core`, and `features` directories. The
entry points stay at `frontend/main.tsx` and `backend/src/lib.rs` because Vite
and Tauri load them directly.

`shared/application-menu.json` is core-owned, cross-runtime data: TypeScript
imports it as constants and Rust embeds the same JSON when building the native
menu. Platform renderers must not duplicate its application tree or command
metadata. OS-only App/Services/Window placement is declared in this configuration.
`shared/keymaps.json` adds navigation commands, default aliases and editor/IDE/Git
GUI preset overrides. The effective keymap is resolved with user preferences;
menu defaults are not the runtime source of truth. See [keymaps](keymaps.md).

| Area | Frontend | Backend |
| --- | --- | --- |
| `common` | Reusable controls, icons, Markdown rendering/sanitizing and Day.js-based date/time display helpers. | Shared process execution. |
| `core` | App composition, window layout, theme and global styles. | App lifecycle, menu/window management, IPC registration, SQLite connection, schema and migrations. |
| `features` | UI components, Zustand stores, services, types and constants grouped by feature. | Feature command handlers, domain modules and SQLite operations grouped by feature. |

Features currently include About, AI, credentials, Git, notifications,
performance and Virtual MR. The backend also has a sandbox feature; its
frontend controls live with AI preferences. Preferences is a frontend feature
that composes settings components from their owning features.

Backend IPC names are stable: `core/commands/mod.rs` re-exports handlers from
the feature modules so `lib.rs` can continue to register the same Tauri commands.
The SQLite connection and migrations are in `core/db`; repository, credential
and Virtual MR records and queries live in their feature `persistence.rs` files.
Frontend imports point to the owning feature or to `common`/`core` directly.
Use `frontend/common/services/ipc/` for Tauri SDK access, including platform
primitives. Prefer the owning leaf module; use its `types.ts` for SDK types.
`pnpm check:architecture` rejects direct `@tauri-apps/*` dependencies outside the
facade and computed dynamic import/require specifiers. Existing callers own
browser guards, fallbacks and lifecycle; see the implemented
[IPC facade specification](frontend_ipc_refactor_spec.md).
Use `frontend/common/utils/dateTime.ts` for displayed dates and times; it treats
numeric timestamps as milliseconds, with explicit Unix-second helpers for Git.
Keep ISO serialization for persistence and IPC separate from display formatting.

The backend's implementation boundaries and safety contracts are documented in
[backend maintenance](backend_maintenance.md). `pnpm check:architecture` checks
source ownership and a 500-line budget for every application Rust file, including
test modules and `backend/build.rs`. Start reviewing module boundaries at 400
lines and aim for 300. These checks also run before production build metadata
changes; see the [refactor report](backend_refactor_analysis.md) for measurements.

When adding a feature, keep its UI, state, types and backend handlers together
under the corresponding feature directory. Put code in `common` only when more
than one feature uses it without depending on feature-specific state.

The [frontend maintenance map](frontend_maintenance.md) documents component,
hook, transaction and store-slice ownership. `pnpm check:architecture` also
enforces a 450-physical-line budget for every frontend TypeScript file. Preserve
the public root hooks/components when extracting named behavior; begin reviewing
boundaries at 400 lines and aim for 100–300.
