# Frontend maintenance map

Read [feature layout](feature_layout.md) for ownership and the
[refactor report](frontend_refactor_analysis.md) for the original audit and measured
implementation. Public component exports, root Zustand hooks, IPC payloads and
events remain stable. Internal bot/ACP form props are grouped by responsibility;
their application callers migrate together (see report section 8).

## Where code belongs

| Workflow | Owner |
|---|---|
| Button surfaces | `core/styles/button-surfaces.css` enforces borderless opaque palette-filled buttons (including filled hover states); `btn-solid` opts custom/inline fills in. Transparent, white and black/dark canvas surfaces may retain borders. Focus outlines remain independent. Keep the palette selector list in sync with new filled utilities; see `.cursor/rules/button-surfaces.mdc`. |
| Onboarding illustrations | `FirstLaunchWelcome.tsx` remains an edge-to-edge window layout with an independently scrolling copy/settings column and persistent navigation. Intro copy comes from `welcomeSlides.ts`. `WelcomeArtworkScene.tsx` frames the three artwork components with explicitly labeled sample metrics and workflow steps from `welcomeArtworkScenes.ts`. Decorative CSS motion lives in `core/styles/onboarding-artwork.css`; it respects reduced motion and must not auto-advance slides, simulate live agent work or trigger IPC/network requests. |
| Git state | `git/store/useGitStore.ts` composes one store. `store/slices/createGitRepoSlice.ts` owns repository lifecycle/recent repos and composes `createGitCloneActions.ts`; `createGitDiffSlice.ts` owns branch comparison/stale-response checks and composes `createGitFileSelectionActions.ts`. Conflict/blame, sync, sandbox and UI have separate slices. Action factories receive the same store's set/get; they do not create stores. |
| Git invalidation | `git/services/gitStoreEffects.ts` owns the shared diff request epoch, error conversion and native recent-repository menu synchronization. Repository changes and diff loads must invalidate the same epoch. |
| AI state | `ai/store/useAiMcpStore.ts` composes config, MCP servers, guardrails and external-agent slices. Keep bootstrap, preference events and delayed native hydration in this facade. `ai/services/aiMcpPersistence.ts` owns normalization, migration and sanitized persistence. |
| AI preferences UI | `ai/hooks/useAiMcpTabState.ts` coordinates draft/committed routing and returns provider/MCP/navigation/setup/removal/details groups. `useAiProviderSetup.ts`, `useAiProviderRemoval.ts`, `useAiProviderDetails.ts` own their workflows. `useMcpServerForm.ts` owns MCP validation/secrets. Provider key/model/endpoint views live under `components/providers/`. `services/checkAiProviderConnection.ts` owns connection transport; the slice owns status publication. |
| Preferences transaction | `preferences/hooks/usePreferencesDraft.ts` coordinates transaction actions and grouped tab APIs. `usePreferencesDraftSession.ts` owns draft seeding/baselines/open-close synchronization; `usePreferencesNavigation.ts` owns navigation/search; `usePreferencesChangeCount.ts` owns dirty counts. `services/createPreferencesApplyAction.ts` still owns ordered commit/publication/error handling. The tab container routes drafts; the modal is the shell. |
| Preferences JSONC editor | `components/usePreferencesJsonDocument.ts` owns load/save/revision conflicts/autosave/polling/close/reset; `usePreferencesJsonCodeBuffer.ts` owns highlighting, caret, scrolling and completions. `PreferencesJsonEditor.tsx` composes the buffer and header. Preserve focus, cursor restoration and external-change protection. |
| Welcome onboarding | `onboarding/constants/welcomeSlides.ts` owns the tour and five optional settings steps: Theme → Keymaps → UI Font → Buffer Font → Markdown Font. `WelcomeThemePicker.tsx` offers System/Light/Dark; `WelcomeSettingsPanel.tsx` reuses Preferences font controls and `KeymapPresetPicker.tsx`; `WelcomeSettingsPreview.tsx` owns responsive samples. `useOnboardingPreferences.ts` owns drafts, OS-appearance preview updates, cleanup, save errors and reload. `services/onboardingPreferences.ts` commits only changed fields in one JSON patch, checks conflicts and publishes after success. Theme previews do not update the committed store or startup cache until the save succeeds; cleanup restores the latest committed theme/fonts. Completing/skipping/closing waits for persistence before setting the welcome flag or opening/cloning a repo. No AI/keychain work is part of this transaction. |
| MR state | `virtual-mr/store/useVirtualMrStore.ts` composes one store's slices. Session reviewer state/assignment/approval actions are in `createSessionReviewerActions.ts`; draft persistence/publication is in `createDraftSubmissionActions.ts`. Draft branch request versions stay in `createDraftMrSlice.ts`. Repository-data request versions stay with repository-data loading. |
| MR detail | `VirtualMrHub.tsx` coordinates the fixed top header and metadata bar with 4 workspace tabs (Overview, Commits, Reviews, Files Changed). `components/hub/` owns tab presentation (`VirtualMrOverviewTab`, `VirtualMrCommitsTab`, `VirtualMrReviewsTab`). `MainLayoutDiffWorkspace.tsx` owns files and diff viewer presentation. `useMrMetadataDropdowns.ts` owns metadata refresh toggles; `services/createStartMrReviewAction.ts` owns review startup. |
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
| Main layout | `core/components/hooks/useMainLayoutCoordination.ts` owns repo/window coordination; `useSidebarResizing.ts` owns the splitter. `layout/MainLayoutModals.tsx` composes dialogs; `layout/MainLayoutDiffWorkspace.tsx` composes the diff workspace. |
| Application menu | `shared/application-menu.json` is the cross-runtime source for command IDs, labels, default accelerators, grouping, enable/check keys and OS placement. `core/constants/applicationMenu.ts` exports typed constants/helpers. `layout/menu-bar/ConfiguredMenu.tsx` renders the tree; `menuIcons.ts` maps presentation icons. `layout/useApplicationMenu.ts` owns native listener disposal, macOS state/keymap sync and the single keyboard registration. `core/services/applicationMenuActions.ts` is the native/custom menu dispatcher; file/text editing have named services. `applicationMenuState.ts` derives flags; `applicationMenuShortcuts.ts` supplies effective shortcut help. |
| Keymaps | `shared/keymaps.json` owns preset overlays, navigation commands and aliases. `core/services/keymaps/catalog.ts` resolves menu defaults → preset → user overrides; `keystroke.ts` normalizes/records/formats keys; `validation.ts` checks records and context/prefix conflicts; `engine.ts` owns chord lifecycle and scope matching. `context.ts` reads live focus/modal/availability state; `actions.ts` routes menu, MR-tab, conflict and recent-repo commands; `native.ts` selects the single native owner. `core/hooks/useCommandShortcut.ts` supplies live hints. Preferences owns its isolated draft, binding editor and transaction; `usePreferencesStore.keymap` is committed runtime state. See [engine contract](keymaps.md). |

## Contracts to preserve

- Compose slices into the original store; never create independent stores or
  subscribe one slice to another store to approximate the old state.
- Keep request counters shared where they were shared, preserve async ordering,
  early exits, single-flight gates, listener cleanup and late-result rejection.
- Preferences drafts remain drafts until Apply/OK; Cancel restores previews and
  discards drafts. The existing native/keychain and JSON rollback logic remains
  authoritative. Account sign-in and other immediate actions are not transactions.
- Markdown typography lives in `appearance.markdownFont`. Its `editorFontFamily`
  is independent of preview `fontFamily` and code-block `codeFontFamily`, with
  a backward-compatible Fira Code default. The draft session, dirty counter,
  commit action and Cancel/reset must carry every Markdown field together.
  `applyMarkdownFontToDocument.ts` publishes `--markdown-editor-font-family` for
  all shared Markdown editor textareas; the font tab reuses `CustomSelect`.
- Interface font family lives in `appearance.uiFont.fontFamily`, defaults to
  bundled IBM Plex Sans, and drives `--font-sans`. Its draft is included in
  Apply/OK/Cancel/reset independently of buffer and Markdown fonts. Keymap preset
  buttons are shared by Preferences and onboarding and retain custom overrides.
  UI font choices come from `services/systemFontCatalog.ts` and
  `useSystemFontFamilies.ts`: native font enumeration plus the actual bundled
  IBM Plex Sans/Fira Code faces. Refresh re-queries the OS; missing saved fonts
  are disabled and labeled unavailable, never silently invented as choices.
  Browser Local Font Access is requested only on a user click; unsupported or
  denied access leaves bundled choices and an explicit status/error. JSONC UI
  font suggestions read the same discovered catalog, not a fixed platform list.
  `KeymapPresetLogo.tsx` renders each application's original-color local asset;
  `constants/keymapPresetLogos.ts` maps IDs, with sources and attribution under
  `assets/keymap-logos/README.md`. Stage0 reuses `AppLogo`. Do not replace logos
  with generic branch icons, recolor them, or fetch them at runtime.
- Never serialize API keys or secret MCP environment values into preferences.
  Do not add background keychain reads, model discovery or account sign-in.
- Keep review consent, ACP/native guardrails, source filtering, immutable Git
  snapshots and publication/evidence checks. UI extraction does not grant tools
  or change backend safety budgets.
- Extracted views receive typed props and callbacks. Keep state/effects in the
  owning workflow; do not duplicate state or move callbacks into render side effects.
- Preserve caller-level React keys when extracting mapped items. Preserve refs,
  accessibility attributes, focus/keyboard handling and conditional mounting.
- Menu changes must update the shared JSON, not introduce a platform-specific
  command list in JSX or Rust. macOS retains App/Services/Window roles, while
  File/Edit/View/Repository/Help use the same application actions on every OS.
  Custom menu buttons preserve text focus. The dispatcher rechecks live state;
  native enable/check flags are UI availability, not authorization.
- Configurable accelerators have one execution owner: eligible native macOS
  application bindings or the common capture engine, never both. Workspace,
  welcome, MR-tab navigation and chords use the common engine, including macOS.
  The old workspace/tab/welcome/inline-blame listeners were removed. Local input,
  menu arrow navigation, Escape/Tab, Markdown editing and JSONC completions remain
  intrinsic control behaviors. Close Window defaults to **Ctrl/Cmd+Shift+W**;
  Close MR Tab defaults to **Ctrl/Cmd+W**, and conflicting remaps are rejected.
- Maintain UI small-rounded consistency: apply `rounded-sm` (`--radius-sm: 4px`)
  across buttons, inputs, selects, textareas, visual `div` containers (cards, panels,
  dialogs, dropdowns, popovers, banners, toasts) and badges/tags. Preserve existing
  `rounded-full` or custom radii. Keep main window roots, window title bar drag
  regions, and Windows-style window controls unrounded (`rounded-none`).

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

## Menu unification checkpoint (2026-10-23)

The shared configuration is imported into the frontend and embedded as JSON data
in the native Rust menu builder; there is no generated code or second menu tree.
The previous hand-written menu components/submenu props and native action switch
were removed. Their tracked history remains recoverable in Git.

Recents supports exact-ID open/remove and clear on each platform. File paths
disambiguate equal repository names. Release Notes, Repository Overview,
rebase continuation/skip/abort, external tools, layout and theme actions are now
also available from the macOS menu. Standard editing uses native roles on macOS
and focused text editing in the custom menu. Native per-window state is restored
on focus and discarded on window destruction.

Menu checks: frontend typecheck, architecture, Cargo check, all 172 Rust tests,
and an isolated production bundle pass. Ten new Node menu tests and four Rust
menu tests cover tree/action parity for all three OS configs, state gates,
shortcut matching/help, listener cleanup, focus preservation and submenu input.
Full Node baseline: 269 tests / 248 pass / 21 fail. Final: 279 tests / 259 pass /
20 fail; no new failures. The old repository-overview JSX-layout assertion now
checks its owning config/icon registry/dispatcher and passes. Other pre-existing
auth/preferences/language/mention failures remain; see test output, not the older
checkpoint's totals, for the current baseline.

Execution was on macOS only. Browser visual QA was attempted but no browser was
available to the UI tool; no live native-menu or Windows/Linux visual smoke test
is claimed. Existing bundle chunk/mixed-import warnings remain. Unrelated dirty
release metadata and Markdown-font settings edits were preserved.

## Keymaps engine checkpoint (2026-10-23)

Preferences → General → Keymap exposes Stage0, VS Code, JetBrains and GitHub
Desktop adaptations, per-command alternatives, unbinding, recording, chords and
reset. Keymap drafts participate in Apply/OK/Cancel and JSONC validation. The
previous workspace/tab/welcome/inline-blame action listeners were removed;
intrinsic control editing/navigation stays local. Menu/help/toolbar/context-menu
hints resolve committed bindings. See [keymaps](keymaps.md) for ownership and
native single-owner execution details.

- Typecheck, architecture checks, Cargo check, edition-2021 formatting of changed
  Rust files, whitespace checks and isolated Vite bundle compilation pass.
- Architecture: **839 frontend files** (largest 410/450), **326 Rust files**
  (largest 499/500). No size/ownership exceptions or version bumps.
- Node baseline: **284 tests / 264 pass / 20 fail**. Final: **300 / 280 / 20**;
  exactly the same failing names. Sixteen new tests cover resolution, conflicts,
  input/IME/repeat, chords, native ownership, effective help, binding recording,
  MR tab dispatch and Preferences success/failure/cancellation/concurrent edits.
  Existing menu and Preferences fixtures gained the APIs used by production;
  no assertions were removed or skipped.
- All **177 Rust tests pass**, including five added keymap/native metadata tests.
- Checks ran on macOS. No live native-window visual QA or Windows/Linux runtime
  keyboard/OS-reserved-shortcut verification is claimed. Existing Vite chunk and
  mixed-import warnings remain.

## Git GUI keymap presets (2026-10-24)

The catalog now has seven presets, adding Fork, SourceTree and GitKraken through
`shared/keymaps.json`, without new keyboard listeners or runtime branches. The
Preferences picker and JSONC completions discover the catalog automatically;
Preferences search includes the new product names. Platform adaptations and
deliberately unassigned conflicting bindings are documented in [keymaps](keymaps.md).
Existing custom overrides and Apply/OK/Cancel behavior remain unchanged.

Thirteen added tests pin the platform mappings, safe collision resolution,
persisted preset IDs, user overrides, picker/search and JSONC completions.
Typecheck, architecture, Cargo check and all four Rust keymap tests pass; the
latter resolve/validate every preset for all three desktop configurations.
Full Node suite: **313 tests / 293 pass / the same 20 baseline failures** (before:
300 / 280 / 20), with no new failing names. Checks ran on macOS; no Windows/Linux
native keyboard or visual QA is claimed. No ownership boundaries moved.
