# Frontend maintenance map

Read [feature layout](feature_layout.md) for ownership, the
[refactor report](frontend_refactor_analysis.md) for the original audit and measured
implementation, and the
[IPC facade refactor specification](frontend_ipc_refactor_spec.md) for the
implemented platform contracts, private adapters and verification checkpoints.
Public component exports, root Zustand hooks, IPC payloads and
events remain stable. Internal bot/ACP form props are grouped by responsibility;
their application callers migrate together (see report section 8).

## Where code belongs

| Workflow | Owner |
|---|---|
| Platform services | `common/services/ipc/contracts/` owns neutral command/event/path/window/capability contracts; `adapters/tauri/` alone constructs SDK channels/window/DPI objects. Browser ports explicitly reject unsupported operations; `adapters/testing/` accepts explicit fakes. `platformServices.ts` selects/installs one platform before startup. `core/services/runtime/` composes 25 typed service objects and supplies the same instance to Context, `useApplicationServices()` and `getApplicationServices()`. Common links/attachments use `common/services/getCommonServices.ts`; common does not import the application composition root. Backend names/payloads live only in owning `services/transport/` factories; these cannot import runtime, stores or components. The architecture gate enforces private SDK/adapter boundaries and caller separation. See [platform contracts](frontend_ipc_refactor_spec.md#12-platform-service-abstraction-2026-10-25). |
| Startup splash | `public/startup.js` owns the pre-React weighted progress controller, early theme and error/reload presentation; `index.html` owns its accessible determinate surface. `core/services/startup/` provides its typed facade. `main.tsx` reports runtime/preferences/interface completion; `MainApp.tsx` coordinates window/repository initialization and workspace readiness. Git owns optional initialization progress callbacks. `core/hooks/useStartupSplash.ts` waits for the ready React tree to paint before completing and dismissing the splash, with cancellable cleanup. See [startup contract](startup_splash.md). |
| Dropdown dismissal | `common/hooks/useOutsideDismiss.ts` owns capture-phase outside pointer/click/focus dismissal for `CustomSelect` and bespoke font, branch and MR metadata pickers. Keep both trigger and popup within the registered ref; inside search and multi-selection must stay open. Do not swallow the outside control's activation or steal its focus. Attach listeners only while open and clean them up on close/unmount. |
| Button surfaces | `core/styles/button-surfaces.css` enforces borderless opaque palette-filled buttons (including filled hover states); `btn-solid` opts custom/inline fills in. Transparent, white and black/dark canvas surfaces may retain borders. Focus outlines remain independent. Keep the palette selector list in sync with new filled utilities; see `.cursor/rules/button-surfaces.mdc`. |
| Scrollbars | `common/components/ScrollArea.tsx` wraps the official OverlayScrollbars React component for vertical scroll surfaces, including onboarding: a 4px visible thumb, transparent track and 700ms scroll-idle hide. `core/styles/index.css` imports its stylesheet and owns the theme, reduced motion and forced-color overrides. Keep its viewport at `z-index: auto` so nested fixed dialogs can escape the scroller's clip. The existing `core/services/autoHideScrollbars.ts` capture listener remains the activity fallback for native scroll surfaces. Native CSS scrollbar styling alone is not reliable in the macOS webview; use `ScrollArea` for a consistent overlay. |
| Onboarding illustrations | `FirstLaunchWelcome.tsx` remains an edge-to-edge window layout with an independently scrolling copy/settings column and persistent navigation. The right column is non-scrolling: `OnboardingPreviewFit.tsx` and `useOnboardingPreviewFit.ts` fit the entire preview into its finite flex viewport using untransformed content dimensions, observing both viewport and content (including font changes). Never hide a scrollbar while leaving content clipped or measure the scaled bounds in a feedback loop. Intro copy comes from `welcomeSlides.ts`. `WelcomeArtworkScene.tsx` frames the three artwork components with explicitly labeled sample metrics and workflow steps from `welcomeArtworkScenes.ts`. Decorative CSS motion lives in `core/styles/onboarding-artwork.css`; it respects reduced motion and must not auto-advance slides, simulate live agent work or trigger IPC/network requests. |
| Git state | `git/store/useGitStore.ts` composes one store. `store/slices/createGitRepoSlice.ts` owns repository lifecycle/recent repos and composes `createGitCloneActions.ts`; `createGitDiffSlice.ts` owns branch comparison/stale-response checks and composes `createGitFileSelectionActions.ts`. Conflict/blame, sync, sandbox and UI have separate slices. Action factories receive the same store's set/get; they do not create stores. |
| Git invalidation | `git/services/gitStoreEffects.ts` owns the shared diff request epoch, error conversion and native recent-repository menu synchronization. Repository changes and diff loads must invalidate the same epoch. |
| AI state | `ai/store/useAiMcpStore.ts` composes config, MCP servers, guardrails and external-agent slices. Keep bootstrap, preference events and delayed native hydration in this facade. `ai/services/aiMcpPersistence.ts` owns normalization, migration and sanitized persistence. |
| AI preferences UI | `ai/hooks/useAiMcpTabState.ts` coordinates draft/committed routing and returns provider/MCP/navigation/setup/removal/details groups. `useAiProviderSetup.ts`, `useAiProviderRemoval.ts`, `useAiProviderDetails.ts` own their workflows. `useMcpServerForm.ts` owns MCP validation/secrets. Provider key/model/endpoint views live under `components/providers/`. `services/checkAiProviderConnection.ts` owns connection transport; the slice owns status publication. |
| Preferences transaction | `preferences/hooks/usePreferencesDraft.ts` coordinates transaction actions and grouped tab APIs. `usePreferencesDraftSession.ts` owns draft seeding/baselines/open-close synchronization; `usePreferencesNavigation.ts` owns navigation/search; `usePreferencesChangeCount.ts` owns dirty counts. `usePreferencesDismiss.ts` routes unconsumed Escape through the same discard/single-flight path as Cancel, leaving child dialogs and IME composition alone. `services/createPreferencesApplyAction.ts` still owns ordered commit/publication/error handling. The tab container routes drafts; the modal is the shell. |
| Preferences JSONC editor | `components/usePreferencesJsonDocument.ts` owns load/save/revision conflicts/autosave/polling/close/reset; `usePreferencesJsonCodeBuffer.ts` owns highlighting, caret, scrolling and completions. `PreferencesJsonEditor.tsx` composes the buffer and header. Preserve focus, cursor restoration and external-change protection. |
| Welcome onboarding | `onboarding/constants/welcomeSlides.ts` owns the eleven-step tour: three introduction slides → optional Theme → Keymaps → UI Font → Buffer Font → Markdown Font → required AI setup → System Integration → Open/Clone repository. `store/useOnboardingStore.ts` tracks onboarding open/close state and synchronizes with application menu flags to deactivate all native menus and keyboard accelerators during onboarding. `WelcomeThemePicker.tsx` offers System/Light/Dark; `WelcomeSettingsPanel.tsx` reuses Preferences font controls and `KeymapPresetPicker.tsx`; `WelcomeSettingsPreview.tsx` owns responsive samples. `WelcomeRepositoryPreview.tsx` owns the final step's illustration. `useOnboardingPreferences.ts` owns appearance/keymap drafts, OS-appearance previews, cleanup, save errors and reload. `services/onboardingPreferences.ts` commits changed appearance/keymap/system-integration fields in one JSON patch and publishes after success. Cleanup restores the latest committed theme/fonts. Navigation to System Integration and the repository step requires a saved AI connection and enabled custom reviewer; completion rechecks both before and after saving, then sets the welcome flag or opens/clones a repo. |
| Required onboarding AI | `WelcomeAiSetup.tsx` reuses `AiMcpTab`, `ExternalAgentsTab` and `BotReviewersTab`; `useOnboardingAiSetup.ts` owns an isolated AI/reviewer draft, explicit save/discard through `commitAiPreferences`, save errors/single-flight and live committed status. `services/onboardingAiStatus.ts` counts explicitly configured providers with model/HTTP endpoint plus confirmed saved key metadata (except keyless Ollama), or a saved ACP launch configuration, and requires one enabled custom reviewer. Defaults, plaintext key drafts and MCP servers do not satisfy the requirements. No automatic keyring reads, inference, process launch or permission bypass: saved-key checks are explicit; agent account management and review guardrails stay with their existing owners. Saved ACP launch configuration is not proof of authentication or inference. Skip/Close/Escape/final repo actions cannot bypass the gate; appearance remains optional. AI-step content must not use a transformed animation ancestor, so reused fixed modals remain viewport-sized. |
| MR state | `virtual-mr/store/useVirtualMrStore.ts` composes one store's slices. Session reviewer state/assignment/approval actions are in `createSessionReviewerActions.ts`; draft persistence/publication is in `createDraftSubmissionActions.ts`. Draft branch request versions stay in `createDraftMrSlice.ts`. Repository-data request versions stay with repository-data loading. |
| MR detail | `VirtualMrHub.tsx` coordinates the fixed top header and metadata bar with 4 workspace tabs (Overview, Commits, Reviews, Files Changed). `components/hub/` owns tab presentation (`VirtualMrOverviewTab`, `VirtualMrCommitsTab`, `VirtualMrReviewsTab`). `MainLayoutDiffWorkspace.tsx` owns files and diff viewer presentation. `useMrMetadataDropdowns.ts` owns metadata refresh toggles; `services/createStartMrReviewAction.ts` owns review startup. |
| MR creation | `NewVirtualMrView.tsx` coordinates branch changes and creation; `useNewMrMetadata.ts` owns dropdown refresh/selection/label creation. `components/new-mr/` owns header/form/errors/commits/preview. `utils/createNewMrDescriptionDraft.ts` creates the metadata-only template. `services/startNewMrReviewBatch.ts` preserves detached review startup after creation. |
| MR list | `useVirtualMrListSearch.ts` owns search/caret/suggestions/keyboard; `useVirtualMrPagination.ts` owns filtering/sorting/page reset/clamp/scroll. The dialog composes these with `components/list/` header/search/keyed items/pagination. Filter before slicing pages. |
| Discussions | `DiscussionThread.tsx` retains quoting, references, submit single-flight and resolve actions. `components/discussion/` owns root/reply cards and reply form. Author handles, badges and time formatting live in `utils/discussionAuthorUtils.ts`. |
| Markdown | `common/components/MarkdownEditor.tsx` owns text/selection/mention/keyboard coordination. `markdown-editor/` owns toolbar, mention popup, footer and `useMarkdownImageDrop.ts` (attachments, clipboard and notifications). Keep existing privacy/MIME validation in `common/utils/imageAttachment.ts`. |
| Clone | `git/hooks/useCloneRepository.ts` coordinates credentials/options/submission; `useCloneRemoteRefs.ts` owns deferred URL/ref validation and cancellation; `useCloneDestination.ts` owns native home/path joining/browse and stale-result rejection. `components/clone/` owns the view sections. |
| Blame and graph | `git/components/blame/` owns presentation; the viewer coordinates reads/refs. `useGitGraphState.ts` owns selection/navigation, `useGitGraphSearch.ts` owns deferred metadata/message search, `useGitCommitMessage.ts` owns cancellable detail reads, and `utils/buildGitGraphLayout.ts` owns the pure lane algorithm. |
| Reviewer forms and persistence | `ai/components/useReviewerBotForm.ts` and `git/components/repository-settings/useRepositoryBotForm.ts` own global/repo form workflows. Draft value types are feature-owned; `common/hooks/useFormDraft.ts` only supplies generic field updates. `useReviewerModelCatalog.ts` resolves provider/model capabilities. `ai/hooks/useAcpReviewerConfigOptions.ts` owns cancellable ACP option discovery, model-dependent reloads and readiness; the form uses that same readiness to gate both the submit button and save handler. `AcpReviewerConfigOptions.tsx` renders its state and recovery actions. Global/ACP modal props use named dialog/identity/execution/catalog groups. `ai/services/botReviewerPersistence.ts` owns normalization/migration/persistence; the store owns actions/events. Repo inheritance cards/rules/items remain presentation. Consent and persistence routing are unchanged. |
| Credentials | `credentials/components/` contains vault/header information, add form and credential card. `GitCredentialsTab.tsx` owns refresh/save/verify/delete/copy coordination. Do not expose secrets in cards or props. |
| External agents | `ai/components/ExternalAgentsTab.tsx` coordinates registry/install/details. `useAcpAgentAccount.ts` owns automatic account checks/auth and request epochs; `useAcpAgentPrompt.ts` owns prompt execution; `useCustomAcpAgentForm.ts` owns custom registration. `components/external-agents/` owns project/account/prompt detail sections and keyed cards. Metadata URL filtering remains in `utils/acpRegistryMetadata.ts`. |
| Review panel | `review/components/ReviewPanel.tsx` retains profile/consent reset, load/poll/focus lifecycle and focus trap. `ReviewConfigurationSection.tsx` renders profile/safety/consent/actions; `ReviewRunSummary.tsx` renders run coverage/publication. Backend tool/evidence/publication checks remain authoritative. |
| Other settings/viewers | Git binary detection/table, sandbox config/instance, file-list filter and conflict-resolution header live in named child directories. Existing tree/graph/endpoint controls are reused, not duplicated. |
| Linux desktop chrome | `core/hooks/useDesktopWindowChrome.ts` owns startup/focus refresh and late-result rejection; `useWindowChromeStore.ts` publishes the native profile. `TopBarTitleRow.tsx` follows System/Custom frames and desktop button placement; `titleBarMouseDown.ts` is the Linux custom drag/double-click owner. `menu-bar/useMenuPopupPosition.ts` owns viewport placement. General Settings drafts `appearance.linuxTitleBar` through the existing Apply/Cancel workflow. See [Linux desktop contract](linux_desktop_windows.md). |
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
  `useSystemFontFamilies.ts`: native font enumeration plus bundled IBM Plex Sans,
  Inter Variable, Roboto Variable and Fira Code faces. IBM Plex Sans, Inter and
  Roboto are suggested first; Fira Code and JetBrains Mono remain available at
  the end of the catalog. Refresh re-queries the OS; missing saved fonts are
  disabled and labeled unavailable, never silently invented as choices.
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

## Frontend Tauri IPC facade (2026-10-25, historical Stage A)

This checkpoint predates the platform service abstraction documented below.
All 70 original SDK-importing consumers now use `common/services/ipc/` leaves.
The six facade modules explicitly re-export native primitives and SDK types;
feature/core owners retain guards, fallbacks, lifecycle and business behavior.
`check-frontend-ipc-boundary.mjs` is enforced by `pnpm check:architecture` and
covers static/type imports, re-exports, import types, import-equals, require and
dynamic imports, including untracked TS/TSX files. Computed specifiers fail closed.

Fresh full Node baseline: **366 / 344 pass / 22 fail**. Final: **383 / 361 pass /
the same 22 failures**, with no lost passing tests or skips/cancellations.
Seventeen new facade, import-gate and notification lifecycle/window tests pass.
The VS Code test now uses the shared loader with the real SDK; existing
assertions remain. An AST audit of all 70 consumers confirms unchanged
non-import code and preserved import bindings after routing through the facade.

Typecheck, architecture, frontend size, Cargo check and whitespace checks pass.
The frontend has 881 TS/TSX files; its largest remains 393/450 lines. No backend
source/schema or version metadata changed. Checks ran headlessly on macOS, with
no live native/browser UI, accounts or Windows/Linux runtime verification.
See the [IPC implementation checkpoint](frontend_ipc_refactor_spec.md#9-implementation-and-verification-checkpoint-2026-10-25)
for actual commands, baseline revision/lockfile and all 22 failing test names.

## Node baseline failures resolved (2026-10-25)

The IPC follow-up fixes all 22 failures recorded at the previous checkpoint.
Full Node results are now **388 tests / 388 pass / 0 fail**, with no skips,
cancellations or lost passing tests. All **180 compiled Rust library tests pass**.
Typecheck, architecture, frontend size, Cargo check and isolated Vite production
compilation pass. Vite retains mixed static/dynamic import and large-chunk warnings.

Actual behavior fixes are Preferences Escape/discard and retained device-auth
error recovery. Escape uses `usePreferencesDismiss.ts` and cannot cancel an
in-flight commit. A failed auth check/cancel/logout clears stale public status,
then attempts one metadata-only recovery without retrying credential access;
recovery failure keeps status cleared and preserves the original error.

Other failures were stale test contracts/fixtures: the ACP migration intentionally
retired provider OAuth/CLI fields, native browser/device UI and registration.
Tests now guard that retirement and exercise active provider/ACP UI plus retained
device-store contracts in isolation; no legacy auth commands were re-registered.
The 180 Rust tests cover compiled modules, not the unregistered legacy OAuth
source. Secret isolation, exact profile selection in legacy source, raw metadata
projection, stale results, single-flight actions and no automatic inference
remain asserted at their relevant boundaries.

Payload checks include `apiKeyRemovals`; Preferences fixtures include current
theme/font APIs; onboarding checks four highlighted slides. Mention submission
tests model macOS, Windows and Linux modifiers. Author-name normalization retains
its Unicode behavior while bundled source remains English. The frontend now has
882 TS/TSX files; its largest remains 393/450 lines. No backend source, dependency
lockfile, version or release metadata changed. Native UI, live accounts/providers
and Windows/Linux runtime behavior remain unexercised on this macOS host.
See the [failure-resolution checkpoint](frontend_ipc_refactor_spec.md#10-baseline-failure-resolution-2026-10-25).


## Platform service abstraction (2026-10-25)

All 70 original consumers now use neutral platform ports or named feature
services. The former re-export leaves and SDK-derived `types.ts` were removed.
All 127 backend operations are preserved, including the four retained dynamic
device-auth actions; no backend registration/schema changes were needed.

- **Composition:** `core/services/runtime/createApplicationServices.ts` constructs
  the graph without starting IPC, subscriptions, credential reads or hydration.
  `applicationRuntime.ts` selects/caches it and rejects replacing an initialized
  runtime. `ApplicationServicesProvider.tsx` wraps both application window roots;
  its Context contains stable services, while existing Zustand stores own state.
- **Backend contracts:** 25 interfaces and constructor-injected factories live in
  `services/transport/` under each owner. Git separates repository/history/sync,
  binaries/remotes/files and sandbox operations. AI separates provider/keychain,
  guardrail, external-agent and retained device-auth operations. Review/harness,
  MR/discussion/repository settings, preferences/fonts, notifications, About,
  performance, core application and reusable links/attachments keep their owners.
- **Progress:** `git/services/createGitProgressHandler.ts` connects plain progress
  callbacks to the task store. Only the native command adapter creates a channel,
  preserving backend serialization, callback order and background task behavior.
- **Events/windows:** event subscribers receive payloads and own asynchronous
  unsubscribe registration. Existing target, late-registration and readiness
  ordering remain. Window handles and monitor records expose plain data with
  explicit logical-size/physical-position methods; badge handling stays owned by
  notifications. No SDK class/type reaches a component or store.
- **Wire records:** Git commit and MR session/reviewer/settings/label records now
  describe the existing serialized responses rather than using untyped results.
  `VirtualMrCommit.body` includes the backend's existing `null` value; rendering
  and serialization behavior did not change.
- **Browser:** capability checks replace environment checks. Existing preferences,
  link, font, image and notification fallbacks retain their owners and behavior.
  Existing Git binary preview mocks and the `mock` query flag stay feature-owned;
  bridge readiness for executable discovery/menu updates is exposed by capabilities.
  Unsupported native operations reject with `UnsupportedCapabilityError`;
  native errors remain raw, with no generic catches/retries or fake successes.

Final verification: **398/398 Node tests**, **180/180 Rust library tests**,
TypeScript, architecture, Cargo check, isolated Vite compilation and whitespace
checks pass. There are **963 frontend files**, largest **395/450**; no file limit
exceptions, backend source/schema changes or release/version/lockfile changes.
The bundle retains mixed-import and large-chunk warnings. Detailed commands and
coverage are recorded in specification section 12. Native UI, real accounts/
providers and Windows/Linux runtime execution remain unverified.

## Determinate startup splash (2026-10-25)

The splash now shows completed weighted startup work, a current phase label,
percentage and step count. It waits for repository initialization, any startup
repository attachment and matching Virtual MR data, then gives the ready React
tree a paint opportunity before publishing 100% and fading. Slow work holds its
actual value; the old timed auto-dismissal and indeterminate animation are gone.
Fatal startup errors retain the interrupted phase and expose Reload Stage0.
Optional fonts and existing background work do not block readiness. See the
[startup contract](startup_splash.md) for weights, lifecycle and ownership.

Verification: **410/410 Node tests**, including 12 new startup cases; typecheck,
architecture, Cargo check, isolated production bundle and whitespace checks pass.
The frontend has **968 TS/TSX files**, largest **395/450**. Existing Vite mixed
static/dynamic import and large-chunk warnings remain. Light/dark progress and
error states were visually checked in Firefox on macOS, along with actual browser
startup reaching the welcome screen. Native Tauri startup and Windows/Linux
runtime behavior were not exercised. No backend source, dependency or release
metadata changed.
