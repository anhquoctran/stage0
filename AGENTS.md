# Stage0 agent guidance

Read [feature layout](docs/architecture/feature_layout.md) before adding modules.
For frontend work, consult the [frontend refactor report](docs/architecture/frontend_refactor_analysis.md).
For backend work, consult [backend maintenance](docs/architecture/backend_maintenance.md)
and the measured [refactor report](docs/architecture/backend_refactor_analysis.md).

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

## Verification and handoff

- Run `pnpm check:architecture`, relevant Node/Rust tests, and `cargo check
  --manifest-path backend/Cargo.toml`. For broad backend moves run all Rust tests.
- Format changed Rust files using edition 2021; avoid reformatting unrelated files.
- Use `pnpm typecheck` for frontend/IPC changes. Build scripts bump versions;
  use direct checks for verification unless packaging is requested.
- Update the maintenance map when responsibilities move. Report actual checks,
  any remaining failures, and platform coverage accurately.
