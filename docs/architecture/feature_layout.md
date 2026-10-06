# Feature layout

Both application sources use `common`, `core`, and `features` directories. The
entry points stay at `frontend/main.tsx` and `backend/src/lib.rs` because Vite
and Tauri load them directly.

| Area | Frontend | Backend |
| --- | --- | --- |
| `common` | Reusable controls, icons, Markdown rendering/sanitizing and Day.js-based date/time display helpers. | Shared process execution. |
| `core` | App composition, window layout, theme and global styles. | App lifecycle, menu/window management, IPC registration, SQLite connection, schema and migrations. |
| `features` | UI components, Zustand stores, services, types and constants grouped by feature. | Feature command handlers, domain modules and SQLite operations grouped by feature. |

Features currently include About, AI, credentials, Git, notifications, updates,
performance and Virtual MR. The backend also has a sandbox feature; its
frontend controls live with AI preferences. Preferences is a frontend feature
that composes settings components from their owning features.

Backend IPC names are stable: `core/commands/mod.rs` re-exports handlers from
the feature modules so `lib.rs` can continue to register the same Tauri commands.
The SQLite connection and migrations are in `core/db`; repository, credential
and Virtual MR records and queries live in their feature `persistence.rs` files.
Frontend imports point to the owning feature or to `common`/`core` directly.
Use `frontend/common/utils/dateTime.ts` for displayed dates and times; it treats
numeric timestamps as milliseconds, with explicit Unix-second helpers for Git.
Keep ISO serialization for persistence and IPC separate from display formatting.

When adding a feature, keep its UI, state, types and backend handlers together
under the corresponding feature directory. Put code in `common` only when more
than one feature uses it without depending on feature-specific state.
