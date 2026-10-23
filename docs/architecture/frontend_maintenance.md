# Frontend maintenance map

Read [feature layout](feature_layout.md) for ownership and the
[refactor report](frontend_refactor_analysis.md) for the original audit and measured
implementation. Public component exports, root Zustand hooks, IPC payloads and
events remain stable. Internal bot/ACP form props are grouped by responsibility;
their application callers migrate together (see report section 8).

## Where code belongs

| Workflow | Owner |
|---|---|
| Git state | `git/store/useGitStore.ts` composes one store. `store/slices/createGitRepoSlice.ts` owns repository lifecycle/recent repos and composes `createGitCloneActions.ts`; `createGitDiffSlice.ts` owns branch comparison/stale-response checks and composes `createGitFileSelectionActions.ts`. Conflict/blame, sync, sandbox and UI have separate slices. Action factories receive the same store's set/get; they do not create stores. |
| Git invalidation | `git/services/gitStoreEffects.ts` owns the shared diff request epoch, error conversion and native recent-repository menu synchronization. Repository changes and diff loads must invalidate the same epoch. |
| AI state | `ai/store/useAiMcpStore.ts` composes config, MCP servers, guardrails and external-agent slices. Keep bootstrap, preference events and delayed native hydration in this facade. `ai/services/aiMcpPersistence.ts` owns normalization, migration and sanitized persistence. |
| AI preferences UI | `ai/hooks/useAiMcpTabState.ts` coordinates draft/committed routing and returns provider/MCP/navigation/setup/removal/details groups. `useAiProviderSetup.ts`, `useAiProviderRemoval.ts`, `useAiProviderDetails.ts` own their workflows. `useMcpServerForm.ts` owns MCP validation/secrets. Provider key/model/endpoint views live under `components/providers/`. `services/checkAiProviderConnection.ts` owns connection transport; the slice owns status publication. |
| Preferences transaction | `preferences/hooks/usePreferencesDraft.ts` coordinates transaction actions and grouped tab APIs. `usePreferencesDraftSession.ts` owns draft seeding/baselines/open-close synchronization; `usePreferencesNavigation.ts` owns navigation/search; `usePreferencesChangeCount.ts` owns dirty counts. `services/createPreferencesApplyAction.ts` still owns ordered commit/publication/error handling. The tab container routes drafts; the modal is the shell. |
| Preferences JSONC editor | `components/usePreferencesJsonDocument.ts` owns load/save/revision conflicts/autosave/polling/close/reset; `usePreferencesJsonCodeBuffer.ts` owns highlighting, caret, scrolling and completions. `PreferencesJsonEditor.tsx` composes the buffer and header. Preserve focus, cursor restoration and external-change protection. |
| MR state | `virtual-mr/store/useVirtualMrStore.ts` composes one store's slices. Session reviewer state/assignment/approval actions are in `createSessionReviewerActions.ts`; draft persistence/publication is in `createDraftSubmissionActions.ts`. Draft branch request versions stay in `createDraftMrSlice.ts`. Repository-data request versions stay with repository-data loading. |
| MR detail | `VirtualMrHub.tsx` coordinates metadata/description/discussion edits. `useMrMetadataDropdowns.ts` owns metadata refresh toggles; `services/createStartMrReviewAction.ts` owns explicit review startup/notifications. `components/hub/` owns presentation. |
| MR creation | `NewVirtualMrView.tsx` coordinates branch changes and creation; `useNewMrMetadata.ts` owns dropdown refresh/selection/label creation. `components/new-mr/` owns header/form/errors/commits/preview. `utils/createNewMrDescriptionDraft.ts` creates the metadata-only template. `services/startNewMrReviewBatch.ts` preserves detached review startup after creation. |
| MR list | `useVirtualMrListSearch.ts` owns search/caret/suggestions/keyboard; `useVirtualMrPagination.ts` owns filtering/sorting/page reset/clamp/scroll. The dialog composes these with `components/list/` header/search/keyed items/pagination. Filter before slicing pages. |
| Discussions | `DiscussionThread.tsx` retains quoting, references, submit single-flight and resolve actions. `components/discussion/` owns root/reply cards and reply form. Author handles, badges and time formatting live in `utils/discussionAuthorUtils.ts`. |
| Markdown | `common/components/MarkdownEditor.tsx` owns text/selection/mention/keyboard coordination. `markdown-editor/` owns toolbar, mention popup, footer and `useMarkdownImageDrop.ts` (attachments, clipboard and notifications). Keep existing privacy/MIME validation in `common/utils/imageAttachment.ts`. |
| Clone | `git/hooks/useCloneRepository.ts` coordinates credentials/options/submission; `useCloneRemoteRefs.ts` owns deferred URL/ref validation and cancellation; `useCloneDestination.ts` owns native home/path joining/browse and stale-result rejection. `components/clone/` owns the view sections. |
| Blame and graph | `git/components/blame/` owns presentation; the viewer coordinates reads/refs. `useGitGraphState.ts` owns selection/navigation, `useGitGraphSearch.ts` owns deferred metadata/message search, `useGitCommitMessage.ts` owns cancellable detail reads, and `utils/buildGitGraphLayout.ts` owns the pure lane algorithm. |
| Reviewer forms and persistence | `ai/components/useReviewerBotForm.ts` and `git/components/repository-settings/useRepositoryBotForm.ts` own global/repo form workflows. Draft value types are feature-owned; `common/hooks/useFormDraft.ts` only supplies generic field updates. `useReviewerModelCatalog.ts` resolves provider/model capabilities. Global/ACP modal props use named dialog/identity/execution/catalog groups. `ai/services/botReviewerPersistence.ts` owns normalization/migration/persistence; the store owns actions/events. Repo inheritance cards/rules/items remain presentation. Consent and persistence routing are unchanged. |
| Credentials | `credentials/components/` contains vault/header information, add form and credential card. `GitCredentialsTab.tsx` owns refresh/save/verify/delete/copy coordination. Do not expose secrets in cards or props. |
| External agents | `ai/components/ExternalAgentsTab.tsx` coordinates registry/install/details. `useAcpAgentAccount.ts` owns automatic account checks/auth and request epochs; `useAcpAgentPrompt.ts` owns prompt execution; `useCustomAcpAgentForm.ts` owns custom registration. `components/external-agents/` owns project/account/prompt detail sections and keyed cards. Metadata URL filtering remains in `utils/acpRegistryMetadata.ts`. |
| Review panel | `review/components/ReviewPanel.tsx` retains profile/consent reset, load/poll/focus lifecycle and focus trap. `ReviewConfigurationSection.tsx` renders profile/safety/consent/actions; `ReviewRunSummary.tsx` renders run coverage/publication. Backend tool/evidence/publication checks remain authoritative. |
| Other settings/viewers | Git binary detection/table, sandbox config/instance, file-list filter and conflict-resolution header live in named child directories. Existing tree/graph/endpoint controls are reused, not duplicated. |
| Main layout | `core/components/hooks/useMainLayoutCoordination.ts` owns repo/window coordination; `useWorkspaceShortcuts.ts` owns shortcut registration/cleanup; `useSidebarResizing.ts` owns the splitter. `layout/useNativeMenuActions.ts` owns native-menu listener/disposal. `layout/MainLayoutModals.tsx` composes dialogs; named repository submenus own sync/open/merge/rebase presentation. |

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

## Latest verification checkpoint (2026-10-22, TS/TSX follow-up)

- **794 TS/TSX files, 47,425 physical lines; largest 299 lines; none at 300+**.
  This follow-up started at 693 files, 44,617 lines, with 30 files at 300+.
  Stylesheets and backend source were not modified. The enforced budget remains
  450; smaller files are an outcome of named responsibilities, not a new limit.
- Typecheck, ownership/450-line frontend/500-line Rust checks and Cargo check pass.
- Isolated production bundle compilation passes; existing mixed static/dynamic
  import and large-chunk warnings remain. No version/release metadata changes.
- Full Node suite: **192 tests, 174 pass, 18 fail**. Follow-up baseline was
  **185 tests, 167 pass, the same 18 fail**; seven workflow tests were added.
- Existing failures are in `ai-keyring-access` (3),
  `ai-preferences-transaction` (3), `ai-runtime-availability` (2), `app-language`
  (1), `chatgpt-browser-auth` (7), `chatgpt-device-auth` (1) and
  `discussion-mentions` (1). Several auth tests target removed APIs/components;
  the others include stale expectations and an existing mention-keyboard failure.
  None were removed, skipped or weakened to conceal failures.
- Follow-up AST comparison: **98** existing state fields/actions match the
  starting revision after ignoring parentheses/formatting. `testAiConnection`
  delegates transport to a service instead; native saved-key/request behavior has
  a focused regression test. The previous wave's 155-field audit is historical.
- New tests cover aggregate field updates, reviewer create/edit/capabilities/ACP
  consent, clone late results, ACP account epochs, pure graph lanes, draft session
  lifecycle and saved-key provider transport. Existing clone source assertions
  follow both hook owners; no assertions were removed or skipped.
- Verified on the current macOS host. No Windows/Linux execution, live provider
  inference, account/keychain interaction or visual native-window QA was performed.
