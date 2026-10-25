# Frontend Tauri IPC Facade Refactoring Specification

Status: **proposed; implementation has not started**. Source inventory reviewed
on **2026-10-25**. `frontend/common/services/ipc/` does not yet exist. This document
defines the target boundary and acceptance criteria; it does not certify that
migration, checks or native runtime verification have been completed.

## 1. Objectives and Scope

### Current state

Direct imports from `@tauri-apps/api/*` occur in **70 frontend files**, with
**79 import declarations**. An AST inventory counts **222 direct function calls**
to locally named imports and **3 constructor calls**. These are separate metrics:
imports are not call sites, and function counts include `isTauri()` checks.
The count excludes methods called on returned window/channel objects and does
not claim to measure backend command executions at runtime.

The imported SDK modules are:

- `core`: `invoke`, `isTauri`, `Channel`.
- `event`: `listen`, `UnlistenFn`.
- `window`: `getCurrentWindow`, `currentMonitor`.
- `path`: `homeDir`, `isAbsolute`, `join`.
- `dpi`: `LogicalSize`, `PhysicalPosition`.

Section 4 contains the full file inventory. To refresh the import inventory,
scan all on-disk `frontend/**/*.ts` and `frontend/**/*.tsx` files, including
untracked files. Count TypeScript AST import declarations whose module specifier
starts with `@tauri-apps/`; count distinct importing file paths separately. For
call counts, resolve each named import's local name and count direct call/new
expressions using that identifier. Review aliases or namespace imports if added.
A quick source listing is available with:

```bash
rg -n '@tauri-apps/' frontend --glob '*.ts' --glob '*.tsx'
```

### Stage A: preserve behavior while introducing the boundary

This specification authorizes a structural migration: centralize SDK imports,
retain existing caller guards/fallbacks and make future imports enforceable.
Use explicit SDK re-exports for the initial primitives. Existing SDK types and
class identities remain visible through the facade, so this stage reduces direct
import coupling without claiming complete independence from Tauri.

Existing browser behavior remains owned by each caller. For example,
`common/utils/openUrl.ts` keeps its `window.open` fallback, while AI preferences
keeps its native-keychain requirement and rollback/publication order. Moving an
import must not silently enable a native-only feature in browser preview.

### Stage B: separately specified behavior changes

Browser fallbacks, custom environment errors, listener lifecycle helpers and
runtime diagnostics require a separate change with explicit contracts and tests.
They are not implementation requirements for Stage A. In particular, do not add
an `isTauri()` preflight to every invocation, remove existing caller guards,
return a successful no-op listener or fabricate filesystem results during this
migration. Section 3.7 constrains any later diagnostics proposal.

## 2. Architectural Constraints and Guardrails

Follow [AGENTS.md](../../AGENTS.md), [feature layout](feature_layout.md), the
[frontend refactor report](frontend_refactor_analysis.md) and the current
[maintenance map](frontend_maintenance.md).

1. **File budgets:** TypeScript files must not exceed 450 physical lines. Aim for
   100–300 and review boundaries at 400; small re-export modules need no padding.
2. **Source ownership:** Define at most one source owner per file as measured by
   `scripts/check-source-ownership.mjs`. Type-only re-exports are permitted;
   placing several locally declared types in a catch-all file is not.
3. **Feature boundaries:** The facade contains feature-independent SDK access.
   Business fallbacks, store state, primary-window policy and workflow lifecycle
   remain with their current owners.
4. **Behavior contracts:** Preserve command names, arguments, optional SDK
   options, serialized fields, event names/targets, result values, rejection
   values, synchronous throws, side-effect order, cancellation and platform paths.
   Preserve locks, transactions, resource budgets, immutable snapshot reads,
   consent, guardrails, secret redaction and zeroization.
5. **Error propagation:** Do not catch and replace native rejection values,
   convert failures to defaults, add retries/timeouts, deduplicate calls or alter
   recoverable/fatal classifications. Existing caller error handling remains.
6. **Regression criteria:** Record a fresh baseline and preserve every previously
   passing test and assertion. Pre-existing failures remain reported by test
   name; they do not make new failures acceptable. See section 5.
7. **Change scope:** Keep Stage A separate from product behavior changes and
   backend schema changes. Update the maintenance map when implementation lands;
   until then, label the facade as planned.

## 3. Target Module Architecture and Public Contracts

```text
frontend/common/services/ipc/
├── types.ts          # Explicit type-only re-exports from the SDK
├── ipcClient.ts      # Explicit invoke, isTauri and Channel re-exports
├── ipcEvents.ts      # Explicit listen re-export
├── ipcWindow.ts      # Explicit window and DPI primitive re-exports
├── ipcPath.ts        # Explicit native path primitive re-exports
└── index.ts          # Explicit public value/type re-exports
```

### 3.1 Types and native signatures

`types.ts` defines no custom fallback options or error class. Re-export the SDK's
`InvokeArgs`, `InvokeOptions`, `EventCallback`, `EventName`, `UnlistenFn`, `Monitor`
and `Window` types, plus event `Options` under the public name `ListenOptions`,
using `export type`. Re-export them explicitly from `index.ts`. Signatures must
match the dependency installed from the lockfile; these sketches describe the
current API rather than replacement declarations to maintain by hand:

```typescript
declare function invoke<T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T>;
declare function isTauri(): boolean;
declare function listen<T>(event: EventName, handler: EventCallback<T>, options?: ListenOptions): Promise<UnlistenFn>;
declare function getCurrentWindow(): Window;
declare function currentMonitor(): Promise<Monitor | null>;
declare function homeDir(): Promise<string>;
declare function isAbsolute(path: string): Promise<boolean>;
declare function join(...paths: string[]): Promise<string>;
```

The third `invoke` argument remains native `InvokeOptions`, including headers;
`listen` keeps its event-target options. Do not repurpose either argument for
facade configuration. Stage A has no custom `IpcInvokeOptions` or
`fallbackValue?: unknown` API. Any later explicit fallback API must
bind its fallback to the result type `T`, distinguish omitted fallback from an
intentional `undefined` result and never handle native failures as browser mode.

### 3.2 Environment and error contract

| Primitive | Native behavior | Browser / headless behavior in Stage A |
|---|---|---|
| `invoke` | SDK call with unchanged arguments, result and rejection value | Preserve SDK failure when called without its required bridge; existing caller guards/fallbacks remain |
| `isTauri` | SDK environment check | SDK environment check; no extra native call or cached override |
| `Channel` | Same SDK constructor, callback order and IPC serialization | Preserve SDK constructor behavior; no fake channel or synthesized progress |
| `listen` | Same subscription, callback envelope, target and unlisten function | Preserve SDK failure; no successful no-op subscription |
| `getCurrentWindow` | Same synchronous window handle and label | Preserve SDK synchronous failure when bridge metadata is absent; no nullable replacement |
| `currentMonitor` | Same promise; native `null` remains `null` | Preserve SDK failure; no fabricated monitor |
| `homeDir`, `isAbsolute`, `join` | Same native path operations and promises | Preserve SDK failure; no guessed home, empty success or POSIX emulation |
| `LogicalSize`, `PhysicalPosition` | Same SDK constructors and coordinate units | Same constructors; creating coordinates does not promise native window access |

The facade must not call native functions or instantiate window/channel objects
at import time. This migration makes no new SSR-support promise. Importing
modules and invoking bridge-dependent APIs are separate concerns; preserve
existing guards and audit import-time behavior with the actual test loader.

### 3.3 Client and streaming ownership

`ipcClient.ts` explicitly re-exports `invoke`, `isTauri` and `Channel` from SDK
`core`. Re-exporting preserves the generic types, function/class identities and
native options without a wrapper preflight. Do not proxy, clone or stringify
`InvokeArgs` or channels. Git progress ownership remains in
`features/git/services/createGitProgressChannel.ts` and the task store.

### 3.4 Event registration and lifecycle ownership

`ipcEvents.ts` explicitly re-exports SDK `listen`; it does not import React,
deduplicate subscribers or automatically clean them up. Each existing hook or
service retains its current registration and disposal workflow.

Preserve these lifecycle contracts at callers:

- Cleanup after registration uses that subscription's own unlisten function.
- If registration resolves after owner cleanup, immediately unlisten that late
  registration instead of retaining it. Keep disposed-callback guards where
  present; do not introduce new callback timing behavior during this move.
- Keep registration failures and partial-registration cleanup on their existing
  paths. Failed registration must not publish listener readiness.
- Two subscribers to one event remain independent, including their targets and
  cleanup. React Strict Mode setup/cleanup must not leak a late subscription.
- Preserve listener-ready handshakes, such as `notification_host_ready`, after
  successful registration and in their existing order.

Existing examples are `useCloneRepository.ts`, `useApplicationMenu.ts` and
`NotificationHost.tsx`. Any future lifecycle helper needs a separate API with an
explicit owner/dispose or abort contract, defined repeated-dispose behavior and
coverage for late resolution, rejection, concurrent subscribers and remounts.

### 3.5 Window, DPI and path ownership

`ipcWindow.ts` explicitly re-exports `getCurrentWindow`, `currentMonitor`,
`LogicalSize` and `PhysicalPosition`. Keep sync versus async behavior, window
labels, methods, coordinate units and monitor-null behavior unchanged.
`core/utils/isPrimaryAppWindow.ts` retains the app-specific primary-window policy.
Do not introduce `getAppWindow()` or `getAppMonitor()` with different contracts.

`ipcPath.ts` explicitly re-exports `homeDir`, `isAbsolute` and `join`. Native
implementations remain authoritative for Unix roots, Windows drive roots, UNC
paths, separators and normalization. Never route native calls through a POSIX
heuristic. Browser preview cannot infer a user's home or validate a real native
clone destination; retain existing error handling and feature restrictions.

### 3.6 Public imports and barrel evaluation

Prefer imports from the owning leaf module, for example:

```typescript
import { invoke, isTauri } from '@/common/services/ipc/ipcClient';
import { listen } from '@/common/services/ipc/ipcEvents';
import type { UnlistenFn } from '@/common/services/ipc/types';
```

Relative imports are also supported. `index.ts` remains an optional convenience
entry point with explicit named value exports and `export type` declarations.
It must not use wildcard re-exports. Runtime re-exports can load every exported
leaf in the CommonJS test harness even when a caller only uses `invoke`; do not
assume bundler tree shaking applies to tests. Leaf imports reduce that dependency
surface; barrel use requires fixtures for its complete runtime import graph.

### 3.7 Diagnostics contract for a later change

Stage A adds no runtime logging. Any separately proposed diagnostics feature must
satisfy all of the following:

- Disabled by default; explicit development opt-in. Production emits no records.
- Allow only a fixed metadata schema: an allowlisted command identifier, duration
  and success/failure status. Do not derive identifiers from payload contents.
- Never record arguments, return values, event payloads, channel messages or raw
  errors/stacks. Errors can contain secrets just as arguments can.
- API keys, passwords, tokens, MCP environment secrets, source/diff text, image
  data and user paths must not reach diagnostics. `commit_ai_preferences` carries
  `apiKeys` and `mcpEnvSecrets`; `save_git_credential` carries sensitive payloads.
- Do not serialize or mutate IPC arguments for inspection. Do not store payloads
  in tracing buffers. A diagnostic sink failure must not change IPC outcomes.
- Test opt-in/production gating and secret exclusion from success and failure
  records. Choose a configuration mechanism that works with the CommonJS harness;
  do not insert `import.meta.env` into harness-loaded code without supporting it.

## 4. Migration Inventory (70 Files)

Snapshot: 2026-10-25. All 70 listed paths currently import Tauri APIs; no importing
file is missing from this table. Counts must be refreshed before implementation.
The target column names the facade directory; choose its owning leaf module from
section 3 for each imported primitive. A file using multiple primitives can import
multiple leaf modules.

### 4.1 Common Utilities (2 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/common/utils/imageAttachment.ts` | `invoke`, `isTauri` from `@tauri-apps/api/core` | `common/services/ipc` |
| `frontend/common/utils/openUrl.ts` | `invoke`, `isTauri` from `@tauri-apps/api/core` | `common/services/ipc` |

### 4.2 Core Application & Layout (7 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/core/App.tsx` | `isTauri` (core), `getCurrentWindow` (window) | `common/services/ipc` |
| `frontend/core/MainApp.tsx` | `invoke`, `isTauri` (core), `listen` (event) | `common/services/ipc` |
| `frontend/core/components/layout/WindowControls.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/core/components/layout/top-bar/TopBarTitleRow.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/core/components/layout/useApplicationMenu.ts` | `invoke`, `isTauri` (core), `listen` (event) | `common/services/ipc` |
| `frontend/core/services/applicationMenuActions.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/core/utils/isPrimaryAppWindow.ts` | `isTauri` (core), `getCurrentWindow` (window) | `common/services/ipc` |

### 4.3 Feature: About (2 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/about/hooks/useAboutInfo.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/about/hooks/useReleaseNotes.ts` | `invoke` (core) | `common/services/ipc` |

### 4.4 Feature: AI & MCP (18 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/ai/components/AcpReviewerConfigOptions.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/ai/components/AgentIcon.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/ai/components/ExternalAgentsTab.tsx` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/components/external-agents/AcpAgentAccountSection.tsx` | `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/components/external-agents/AcpAgentCard.tsx` | `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/components/external-agents/AcpAgentPromptSection.tsx` | `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/components/external-agents/AcpRegistryActions.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/ai/components/useAcpAgentAccount.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/components/useAcpAgentPrompt.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/ai/constants/aiMcpConstants.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/hooks/useAiProviderRemoval.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/services/aiMcpPersistence.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/services/checkAiProviderConnection.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/services/commitAiPreferences.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/store/slices/createAiConfigSlice.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/store/slices/createGuardrailsSlice.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/store/useAiMcpStore.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/ai/store/useChatGptDeviceAuthStore.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |

### 4.5 Feature: Credentials (2 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/credentials/components/GitCredentialsTab.tsx` | `listen` (event) | `common/services/ipc` |
| `frontend/features/credentials/store/useGitCredentialsStore.ts` | `invoke` (core) | `common/services/ipc` |

### 4.6 Feature: Git (19 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/git/components/RepositoryOverviewModal.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/components/diff-viewer/useInlineBlamePortal.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/hooks/useCloneDestination.ts` | `homeDir` (path) | `common/services/ipc` |
| `frontend/features/git/hooks/useCloneRemoteRefs.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/hooks/useCloneRepository.ts` | `listen` (event) | `common/services/ipc` |
| `frontend/features/git/hooks/useGitCommitMessage.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/hooks/useGitGraphSearch.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/hooks/useGitGraphState.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/services/createGitProgressChannel.ts` | `Channel` (core) | `common/services/ipc` |
| `frontend/features/git/services/gitStoreEffects.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/services/resolveCloneDestination.ts` | `isAbsolute`, `join` (path) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitCloneActions.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitConflictBlameSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitDiffSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitRepoSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitSandboxSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/slices/createGitSyncSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/store/useGitBinaryStore.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/git/utils/fileActions.ts` | `invoke` (core) | `common/services/ipc` |

### 4.7 Feature: Notifications (4 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/notifications/components/NotificationHost.tsx` | `invoke` (core), `LogicalSize`, `PhysicalPosition` (dpi), `currentMonitor`, `getCurrentWindow` (window), `listen` (event) | `common/services/ipc` |
| `frontend/features/notifications/components/NotificationsTab.tsx` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/notifications/services/notificationBadgeService.ts` | `isTauri` (core), `getCurrentWindow` (window) | `common/services/ipc` |
| `frontend/features/notifications/services/notificationService.ts` | `invoke`, `isTauri` (core), `listen`, `UnlistenFn` (event) | `common/services/ipc` |

### 4.8 Feature: Onboarding, Performance & Preferences (5 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/onboarding/components/FirstLaunchWelcome.tsx` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/performance/services/performanceService.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/preferences/hooks/useSystemFontFamilies.ts` | `isTauri` (core) | `common/services/ipc` |
| `frontend/features/preferences/services/preferencesJsonService.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/preferences/services/systemFontCatalog.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |

### 4.9 Feature: Review & Virtual MR (10 files)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/features/review/services/assignedReviewService.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/review/store/useHarnessConnectionStore.ts` | `invoke`, `isTauri` (core) | `common/services/ipc` |
| `frontend/features/review/store/useReviewStore.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/services/sessionPersistence.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/createDiscussionSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/createDraftMrSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/createRepoSettingsSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/createSessionSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/slices/createRepoDataSlice.ts` | `invoke` (core) | `common/services/ipc` |
| `frontend/features/virtual-mr/store/slices/createSessionCreationSlice.ts` | `invoke` (core) | `common/services/ipc` |

### 4.10 Entry Point (1 file)
| File | Current Imports | Migration Target |
|---|---|---|
| `frontend/main.tsx` | `invoke`, `isTauri` (core) | `common/services/ipc` |

---

## 5. Test Compatibility and Acceptance Criteria

### 5.1 What the current harness actually guarantees

`scripts/helpers/componentHarness.mjs` resolves relative/alias imports recursively
and supplies external-module mocks from the shared dependencies object. That
allows SDK mocks to reach the new leaf modules, but does not prove every fixture
will work unchanged.

Known constraints:

- `application-menu.test.mjs` and `git-task.test.mjs` have fixtures that mock only
  `core.invoke`. Adding a wrapper call to `isTauri()` would require another mock
  and change behavior; Stage A's direct re-export avoids that preflight.
- Fixtures such as `clone-destination.test.mjs` mock only path functions. A barrel
  importing other runtime SDK modules can require more fixtures. Prefer the leaf
  import or provide explicit mocks for all runtime dependencies actually loaded.
- Some fixtures mock feature modules by canonical identity. Move import paths
  together with their owners and preserve the shared module/cache identity.
- The harness transpiles TypeScript into CommonJS and executes it with
  `new Function`. `import.meta.env` is not automatically supported.
- The resolver catches errors during recursive module loading and can fall back
  to missing dependencies. Check actual facade exports/call behavior in focused
  tests; a module appearing to load is not evidence of correct wiring.

Update fixtures or source-layout paths only where required by the new boundary.
Keep behavioral assertions; never broaden mocks to fabricate native success,
suppress failures or remove assertions to make migration appear green. Add any
missing SDK mocks explicitly. Test the production import path, including a
barrel fixture if the barrel is used in production.

### 5.2 Baseline and regression policy

The latest recorded checkpoint in `frontend_maintenance.md` (2026-10-24) is
**313 tests / 293 pass / 20 fail**. This is historical documentation, not a fresh
execution result for this specification. Before implementation, run the full
Node suite and capture test names/statuses, counts and environment as the actual
baseline. Record architecture, typecheck and Cargo results too.

Acceptance requires:

1. Every baseline-passing test still passes; no new failing names, skips,
   cancellations or weakened assertions. New contract tests pass. If an assertion
   needs a source-path update, retain its original behavioral intent.
2. Report pre-existing failures by name and distinguish them from regressions.
   If failures are fixed, explain the fix; do not claim the suite is fully green
   while any failures remain. A flaky result needs investigation and disclosure.
3. Typecheck and architecture checks pass, including the new import boundary
   check at migration completion. Document any baseline infrastructure blocker
   without treating a newly introduced failure as an exception.
4. Preserve native and browser outcomes at affected callers; no new implicit
   success, environment preflight, transport retry or persistence publication.
5. Report platform coverage accurately. Path fixtures for Windows/UNC do not
   establish live Windows runtime coverage.

### 5.3 Focused verification matrix for implementation

| Area | Required evidence |
|---|---|
| Client API | Existing representative commands keep argument shape and SDK options, generic results, raw string/object rejection values and streaming channel identity/serialization |
| Environment behavior | Existing browser guards and feature fallbacks remain; unguarded native calls retain failures; no bridge calls at module import |
| Events | Register/unregister, late resolution after cleanup, registration rejection, independent subscribers/targets and preserved readiness ordering |
| Window/DPI | Sync window access, native monitor-null result and existing logical/physical coordinate use preserved |
| Paths | Existing native home behavior, Unix roots, Windows drive roots and UNC tests pass; no POSIX substitute or guessed browser home |
| Harness | Invoke-only, path-only and event fixtures resolve the actual leaf imports; any production barrel use has complete runtime mocks |
| Boundary checker | Finds static, type-only, re-export, import-equals/require and dynamic Tauri imports outside the facade, including an untracked fixture; allows explicit facade imports and ignores comments |

Use existing tests for covered behavior. Add focused tests only for uncovered
contracts and the new boundary enforcement; avoid duplicating SDK internals.
This matrix is an implementation requirement, not a claim tests already exist.

## 6. Import Boundary Enforcement

After migration, all frontend dependencies on **`@tauri-apps/*`**, including
`api`, `plugin-dialog` and `plugin-fs`, must enter through
`frontend/common/services/ipc/`. The current source inventory contains API
imports only. Future plugins require a named facade module for their primitive
access; feature policy remains outside it.

Add `scripts/check-frontend-ipc-boundary.mjs` and integrate its result into
`scripts/check-architecture.mjs`, so `pnpm check:architecture` (including any CI
job running it) fails on boundary violations. The current architecture checker
checks ownership and size only; this rule is not implemented yet.

The checker must:

- Walk all on-disk frontend TS/TSX sources, including untracked files, rather than
  relying on Git's tracked-file list. Resolve the allowed facade directory by
  normalized path and directory boundary, not a loose substring match.
- Parse TypeScript and inspect static imports (including side-effect/type-only),
  re-exports, import type expressions, import-equals, literal dynamic imports and
  literal `require` calls. Reject `@tauri-apps/` specifiers outside the facade.
- Fail closed on computed module specifiers in dynamic import/require forms
  within frontend sources, with a file/line diagnostic, so computed Tauri access
  cannot bypass the rule. Do not introduce aliases for direct SDK access.
- Ignore mentions in comments/strings that are not module dependencies; report
  each actual violation with file, line and module specifier. Do not exempt tests
  located under `frontend/`.
- Have focused fixtures for every supported syntax, allowed facade imports,
  ordinary imports, comments and untracked-file discovery. Report violations
  through the existing architecture check's failure status.

During incremental migration, run the checker to report remaining files; enforce
zero violations when the migration is complete. Do not add permanent per-file
exceptions or enable a failing mandatory gate halfway through the migration.
A recursive `rg` scan is a supplemental audit; zero text matches alone is not
acceptance evidence for the AST boundary rule.

## 7. Execution Roadmap

### Phase 0: Capture the starting state

1. Refresh section 4's inventory and counts from on-disk sources; record the
   revision/worktree state and the dependency lockfile used.
2. Run the full Node baseline, typecheck, architecture and Cargo check. Save the
   failing test names and environment before changing imports.
3. Review the harness and existing lifecycle/path/persistence owners. Keep this
   document and the maintenance map marked proposed until implementation lands.

### Phase 1: Build facade primitives

1. Create the six modules in section 3 with explicit value/type re-exports.
   Include DPI exports and native options; add no fallback/logging wrappers.
2. Add focused facade verification for any uncovered section 5.3 contracts.
3. Implement the boundary checker and its fixtures; initially use it to inventory
   remaining direct imports. Defer the mandatory architecture gate until phase 4.
4. Run typecheck, architecture and the focused facade/checker tests.

### Phase 2: Migrate common and core

1. Move imports in the 2 common files, 7 core files and `frontend/main.tsx` to the
   owning facade leaves. Preserve existing guards, fallbacks and cleanup.
2. Run `application-menu.test.mjs`, `top-bar-version.test.mjs`,
   `external-links.test.mjs` and `image-attachment.test.mjs` with `node --test`.
3. Compare each result with baseline and update only necessary fixture wiring.

### Phase 3: Migrate features

1. **Git (19 files):** migrate leaf imports; run `clone-destination.test.mjs`,
   `clone-remote-refs.test.mjs` and `git-task.test.mjs`. Preserve task/channel
   ownership, destination validation and stale-result/cleanup behavior.
2. **AI (18) and Review (3):** run the existing `ai-*.test.mjs`,
   `acp-*.test.mjs`, `chatgpt-*.test.mjs`, `onboarding-ai-setup.test.mjs`,
   `bot-reviewer-models.test.mjs` and `review-*.test.mjs` suites. Compare known
   failures by name; preserve secrets, consent and commit/rollback order.
3. **Virtual MR (7):** run `virtual-mr-*.test.mjs`; preserve draft/session
   persistence, review publication and caller error handling.
4. **Remaining features (13):** migrate About (2), Credentials (2), Notifications
   (4), Onboarding (1), Performance (1) and Preferences (3). Run
   `preferences-*.test.mjs`, `system-fonts.test.mjs`, `onboarding-*.test.mjs` and
   relevant existing tests for migrated consumers. Add focused lifecycle coverage
   only where the required cases are missing.
5. Run typecheck and architecture checks after each coherent batch; investigate
   regressions before continuing.

### Phase 4: Enforce and hand off

1. Require zero direct Tauri dependencies outside the facade, using the AST
   boundary checker. Integrate it into `pnpm check:architecture` and run its tests.
2. Run final verification without version-bumping build/packaging scripts:

   ```bash
   pnpm typecheck
   pnpm check:architecture
   pnpm check:frontend-size
   node --test scripts/*.test.mjs
   cargo check --manifest-path backend/Cargo.toml
   ```

3. Compare test names/statuses with phase 0, including skips/cancellations. Report
   actual commands, results, remaining baseline failures and platform coverage.
   Document any native/browser smoke checks actually performed; list unexercised
   paths rather than claiming cross-platform runtime verification.
4. Update this spec's status and the feature layout/maintenance map to describe
   implemented responsibilities only after all migration acceptance criteria
   have been assessed. Record remaining blockers explicitly.

## 8. Deferred Behavior Work

Stage A is complete when the import boundary is implemented and enforced, SDK
contracts and existing caller behavior are preserved, and section 5's regression
criteria are met. It does not require resolving unrelated baseline failures.

A later browser-support proposal must define each API's unsupported outcome,
feature-owned fallback, typed return and side effects. Native keychain writes,
persistence, Git mutations, review publication and listener readiness must never
be reported successful without their actual native operation. Home-directory
selection and native path validation require real platform support; a browser
preview must not claim it has that support by manufacturing a POSIX path.

A later lifecycle or diagnostics proposal must satisfy sections 3.4 and 3.7 and
remain a separately reviewable behavior change.
