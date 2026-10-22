# Frontend maintenance map

Read [feature layout](feature_layout.md) for ownership and the
[refactor report](frontend_refactor_analysis.md) for the original audit and measured
implementation. Public component exports, prop contracts, root Zustand hooks,
IPC payloads and events remain stable.

## Where code belongs

| Workflow | Owner |
|---|---|
| Git state | `git/store/useGitStore.ts` composes one store. `store/slices/createGitRepoSlice.ts` owns repository lifecycle/recent repos/clone; `createGitDiffSlice.ts` owns branch comparison, stale-response checks and selection; `createGitConflictBlameSlice.ts` owns conflict/blame reads; `createGitSyncSlice.ts` owns pull/merge/rebase; sandbox and UI have separate slices. |
| Git invalidation | `git/services/gitStoreEffects.ts` owns the shared diff request epoch, error conversion and native recent-repository menu synchronization. Repository changes and diff loads must invalidate the same epoch. |
| AI state | `ai/store/useAiMcpStore.ts` composes config, MCP servers, guardrails and external-agent slices. Keep bootstrap, preference events and delayed native hydration in this facade. `ai/services/aiMcpPersistence.ts` owns normalization, migration and sanitized persistence. |
| AI preferences UI | `ai/hooks/useAiMcpTabState.ts` coordinates provider details/setup/removal and draft/committed routing. `useMcpServerForm.ts` owns server form state, validation and secret-environment handling. Provider key/model forms live under `components/providers/`; reviewer prompt/model forms under `components/reviewer-bot/`. |
| Preferences transaction | `preferences/hooks/usePreferencesDraft.ts` owns isolated drafts, baseline synchronization, dirty counts, reset/cancel and navigation. `services/createPreferencesApplyAction.ts` owns ordered commit/publication/error handling. `PreferencesTabContainer.tsx` routes typed draft values to feature tabs; `PreferencesModal.tsx` is the shell. |
| MR state | `virtual-mr/store/useVirtualMrStore.ts` composes existing discussion/settings/session/draft slices with new repository-data, session-creation and UI slices under `store/slices/`. Request versions stay with repository-data loading. |
| MR detail | `VirtualMrHub.tsx` coordinates loading, metadata edits, description/discussion actions and review startup. `components/hub/` contains header, metadata bar, overview and commits presentation. |
| MR creation | `NewVirtualMrView.tsx` coordinates draft state, branch changes, creation and review startup. `components/new-mr/` contains header, form, comparison error, commits list and preview toolbar. Existing label/reviewer sections remain reusable owners. |
| MR list | `VirtualMrListDialog.tsx` retains global search/sort/filter/pagination and keyboard logic. `components/list/` owns search presentation, keyed list items and pagination toolbar. Filter before slicing pages. |
| Discussions | `DiscussionThread.tsx` retains quoting, references, submit single-flight and resolve actions. `components/discussion/` owns root/reply cards and reply form. Author handles, badges and time formatting live in `utils/discussionAuthorUtils.ts`. |
| Markdown | `common/components/MarkdownEditor.tsx` owns text/selection/mention/keyboard coordination. `markdown-editor/` owns toolbar, mention popup, footer and `useMarkdownImageDrop.ts` (attachments, clipboard and notifications). Keep existing privacy/MIME validation in `common/utils/imageAttachment.ts`. |
| Clone | `git/hooks/useCloneRepository.ts` owns URL/ref validation, stale request handling, credentials, destination joining and submission. `components/clone/` owns URL, credentials and destination sections. The modal composes them with existing clone-options controls. |
| Blame and graph | `git/components/blame/` owns toolbar, line table and commit details; `BlameViewer.tsx` coordinates existing reads/refs. `git/hooks/useGitGraphState.ts` owns graph/search/selection lifecycle; `GitGraphModal.tsx` reuses existing `git-graph/` presentation. |
| Repository bots | `git/components/repository-settings/` contains custom bot form, custom rules and bot item. The tab retains inheritance, selection and persistence routing. ACP controls and source-transfer consent are unchanged. |
| Credentials | `credentials/components/` contains vault/header information, add form and credential card. `GitCredentialsTab.tsx` owns refresh/save/verify/delete/copy coordination. Do not expose secrets in cards or props. |
| External agents | `ai/components/ExternalAgentsTab.tsx` owns registry/account/prompt lifecycle. `components/external-agents/` contains actions, filters, keyed agent cards, custom form and agent details. `utils/acpRegistryMetadata.ts` formats distribution metadata and filters public project URLs. |
| Other settings/viewers | Git binary detection/table, sandbox config/instance, file-list filter and conflict-resolution header live in named child directories. Existing tree/graph/endpoint controls are reused, not duplicated. |
| Main layout | `core/components/hooks/useMainLayoutCoordination.ts` owns repo/window/shortcut coordination; `useSidebarResizing.ts` owns the splitter. `layout/MainLayoutModals.tsx` composes dialogs. `menu-bar/RepositorySyncSubmenu.tsx` and `RepositoryOpenSubmenu.tsx` own their named submenus. |

## Contracts to preserve

- Compose slices into the original store; never create independent stores or
  subscribe one slice to another store to approximate the old state.
- Keep request counters shared where they were shared, preserve async ordering,
  early exits, single-flight gates, listener cleanup and late-result rejection.
- Preferences drafts remain drafts until Apply/OK; Cancel restores previews and
  discards drafts. The existing native/keychain and JSON rollback logic remains
  authoritative. Account sign-in and other immediate actions are not transactions.
- Never serialize API keys or secret MCP environment values into preferences.
  Do not add background keychain reads, model discovery or account sign-in.
- Keep review consent, ACP/native guardrails, source filtering, immutable Git
  snapshots and publication/evidence checks. UI extraction does not grant tools
  or change backend safety budgets.
- Extracted views receive typed props and callbacks. Keep state/effects in the
  owning workflow; do not duplicate state or move callbacks into render side effects.
- Preserve caller-level React keys when extracting mapped items. Preserve refs,
  accessibility attributes, focus/keyboard handling and conditional mounting.

## Budgets and verification

Aim for 100–300 lines, review at 400, enforce **450 physical lines** for every
frontend `.ts`/`.tsx` file, including types. Comments and blank lines count.
Do not bypass the budget with minification, generated fragments, exclusions or
limit increases. Each file has at most one component/type owner. Props types are
separate sibling files; pure helpers must have a named responsibility.

Run `pnpm typecheck`, `pnpm check:architecture`, relevant `node --test` suites and
`pnpm test`. The shared component harness resolves mocks by canonical module
identity, caches loaded modules and uses the production automatic JSX runtime.
Tests must follow the owning implementation after moves, retain assertions, and
traverse child components rather than assume all JSX lives in a facade.

Do not use `pnpm build` just for verification: packaging scripts bump versions,
and loading the normal Vite config synchronizes release metadata. A bundle check
can call Vite's `build` API with `configFile: false`, the same React/Tailwind
plugins and `@` alias, and an isolated temporary output directory.

## Verification checkpoint (2026-10-22)

- Typecheck, ownership/450-line frontend/500-line Rust checks and Cargo check pass.
- Direct production bundle compilation passes (703 transformed modules); existing
  mixed static/dynamic import and large-chunk warnings remain.
- Full Node suite: **185 tests, 167 pass, 18 fail**. The baseline was **181 tests,
  163 pass, the same 18 fail**; four refactor regression tests were added.
- Existing failures are in `ai-keyring-access` (3),
  `ai-preferences-transaction` (3), `ai-runtime-availability` (2), `app-language`
  (1), `chatgpt-browser-auth` (7), `chatgpt-device-auth` (1) and
  `discussion-mentions` (1). Several auth tests target removed APIs/components;
  the others include stale expectations and an existing mention-keyboard failure.
  None were removed, skipped or weakened to conceal failures.
- Git/AI/MR store extraction was additionally compared against the starting
  revision: ASTs of **155** existing state fields/action implementations match
  after normalizing the shared epoch reference and harmless parentheses/formatting.
- Verified on the current macOS host. No Windows/Linux execution, live provider
  inference, account/keychain interaction or visual native-window QA was performed.
