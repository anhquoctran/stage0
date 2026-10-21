# Backend refactor report

## Completed scope

Measured on 2026-10-21 against HEAD a4f5cb3. The ten large files identified in
this analysis have been decomposed by responsibility, retaining their public
module paths. Four additional files over the new size budget were split too.
The full application Rust tree now fits a 500-line limit per file, including
tests and the build script; the largest file is 499 lines.

The original analysis had obsolete Windows-local links and attributed SSE
parsing to the review runtime. Native provider transport is non-streaming and
belongs under review/provider, while the runtime owns adapter orchestration.

Line counts include comments, blank lines and tests. The final column includes
all child modules, including existing children and extracted tests. Counts are
a checkpoint, not a reason to split otherwise cohesive small modules.

| Original file | Before | Current facade/root | Largest child |
|---|---:|---:|---:|
| [`features/review/runtime.rs`](../../backend/src/features/review/runtime.rs) | 1714 | 134 | 351 |
| [`features/preferences.rs`](../../backend/src/features/preferences.rs) | 1696 | 28 | 335 |
| [`features/git/commands.rs`](../../backend/src/features/git/commands.rs) | 1239 | 20 | 341 |
| [`features/review/context.rs`](../../backend/src/features/review/context.rs) | 873 | 40 | 274 |
| [`features/git/ops.rs`](../../backend/src/features/git/ops.rs) | 889 | 25 | 206 |
| [`features/credentials/mod.rs`](../../backend/src/features/credentials/mod.rs) | 841 | 38 | 233 |
| [`features/ai/acp.rs`](../../backend/src/features/ai/acp.rs) | 823 | 35 | 358 |
| [`core/db/mod.rs`](../../backend/src/core/db/mod.rs) | 779 | 93 | 378 |
| [`features/sandbox/guardrails/guardrails_engine.rs`](../../backend/src/features/sandbox/guardrails/guardrails_engine.rs) | 659 | 80 | 214 |
| [`features/review/provider.rs`](../../backend/src/features/review/provider.rs) | 610 | 13 | 193 |
| [`features/ai/preferences.rs`](../../backend/src/features/ai/preferences.rs) | 582 | 435 | 200 |
| [`features/ai/cli_bridge.rs`](../../backend/src/features/ai/cli_bridge.rs) | 581 | 434 | 152 |
| [`features/sandbox/tool_bridge.rs`](../../backend/src/features/sandbox/tool_bridge.rs) | 552 | 428 | 73 |
| [`features/virtual_mr/persistence.rs`](../../backend/src/features/virtual_mr/persistence.rs) | 530 | 243 | 299 |

## Implemented boundaries

- Preferences now separates manager/locking, secure storage, JSONC patching,
  schema/field/record validation, secret rejection, legacy migration, runtime
  application and Tauri commands. The manager retains lock and recovery order.
- Git IPC is grouped by repository, clone, credential handling, history/diff,
  sync, refs, settings and external-app integration. Git operations separately
  own sync, remotes, refs, URL validation and history.
- Review lifecycle, model turns, tool-turn coordination, staged state, action
  execution, submission and prompts have separate modules. Snapshot capture,
  blob reads, tool context, evidence validation and provider wire operations
  also have their own owners.
- ACP separates public records, registry/icon requests, launch validation,
  process transport, account projection, prompts and isolated review sessions.
- Credentials separates scan coordination, metadata discovery, helper lookup,
  origin/identity handling, one-time clone credentials and OS vault operations.
- SQLite initialization, storage location migration, schema migrations and
  settings queries are separate. Virtual MR discussions are separate from the
  session/metadata transaction implementation.
- Guardrail policy state, source-read evaluation, command policy, audit/output
  limits and simulation are separate. Sandbox tool schemas and tests are split.
- Tests moved with their feature and retained their assertions. A small frontend
  sign-in-history type extraction also restores the source-owner check while
  keeping its original type export available.

The [maintenance map](backend_maintenance.md) records module ownership and the
contracts to preserve. In particular, action dispatch retains separate fatal
run errors and recoverable tool errors, and Tauri facades re-export companion
command macros along with handler functions.

## Prevention and agent handoff

- [AGENTS.md](../../AGENTS.md) gives repository-wide agent instructions.
- [.cursor/rules/backend-modularity.mdc](../../.cursor/rules/backend-modularity.mdc)
  applies the backend coding rules to Rust source.
- Aim for 300 lines; review boundaries at 400; the hard limit is 500 physical
  lines per Rust file. Tests follow the same budget. There are no per-file
  allowances, and vendor/build output is outside the application-source scan.
- The size checker is included in the Node tests and pnpm check:architecture.
  Production build preflight runs ownership/size checks before version metadata
  is changed. A 501-line fixture was rejected and version-file hashes remained
  identical; the temporary fixture was removed afterward.

## Verification checkpoint

- Rust baseline: 167 tests passed. Refactored backend: 168 tests passed, including
  a new check that a persistence failure aborts a review action while an
  incomplete diff inventory remains a recoverable tool rejection. Existing ACP
  tests also assert the stable description_updated event kind.
- cargo check and TypeScript type checking pass.
- Architecture checks pass: 566 frontend files and 312 Rust files; largest Rust
  file 499/500 lines. Changed Rust files pass edition-2021 rustfmt checks.
- Full Node suite baseline in a detached HEAD worktree: 172 tests, 153 passed,
  19 failed. Current tree: 175 tests, 157 passed, 18 failed. Every current failing
  test also fails at HEAD; the source-owner failure is fixed. The temporary
  baseline worktree was removed after comparison.
- Existing Node failures remain in auth/keyring/preferences UI expectations,
  runtime availability, application-language scanning, removed ChatGPT auth
  components, and mention keyboard autocomplete. No assertions were disabled or
  removed to obtain these results.
- Workspace-wide cargo fmt --check still reports formatting differences in 16
  untouched files. They are outside this structural patch's formatting scope.
- Execution was verified on macOS. Platform branches and registry architecture
  checks are retained; Windows/Linux native execution requires those platforms.

## Continuing maintenance

Use the ownership map before adding code. Files near the budget, such as
ai/dynamic_models.rs, sandbox/docker.rs and git/mod.rs, should receive new child
modules when their responsibilities grow. Keep structural moves separate from
product changes and rerun the relevant behavior tests at each boundary.
