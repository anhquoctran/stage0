# Frontend Refactor Report & Agent Handoff Specification

> **Date**: 2026-10-22  
> **Target Scope**: Frontend codebase (`frontend/` directory, 567 TypeScript/TSX files)  
> **Status**: Implemented — verification caveats recorded in section 7
> **Companion Document**: [Feature Layout](feature_layout.md) · [Backend Refactor Report](backend_refactor_analysis.md) · [AGENTS.md](../../AGENTS.md)

---

## 1. Executive Summary & Size Distribution

This section and the inventory below preserve the **starting audit**. See sections 7–8
for implementation measurements and the maintenance map for current ownership.

A comprehensive audit of the Stage0 frontend codebase identified **24 files exceeding 400 lines**, with **14 files exceeding 500 lines** (the maximum threshold enforced for backend Rust files and recommended target for frontend maintainability).

```mermaid
xychart-beta
    title "Frontend Codebase Size Distribution (567 files)"
    x-axis ["> 700 lines", "600-699 lines", "500-599 lines", "400-499 lines", "300-399 lines", "< 300 lines"]
    y-axis "Number of Files" 0 --> 550
    bar [4, 5, 5, 10, 15, 528]
```

- **Target budget**: Aim for ~300 lines per file; review boundaries at 400 lines; target max 500 lines per file.
- **Healthy majority**: **528 files (~93.1%)** are already concise (< 300 lines).
- **Core refactor targets**: The top 14 files (≥ 500 lines) represent the bulk of cognitive load and architectural coupling.

---

## 2. Inventory of Large Files (≥ 400 lines)

| # | File Path | Physical Lines | Module Type | Complexity | Recommended Action |
|---|---|:---:|---|:---:|---|
| 1 | [`frontend/features/git/store/useGitStore.ts`](../../frontend/features/git/store/useGitStore.ts) | **895** | Zustand Store | High | Decompose into 5 domain slices |
| 2 | [`frontend/features/ai/store/useAiMcpStore.ts`](../../frontend/features/ai/store/useAiMcpStore.ts) | **771** | Zustand Store | High | Decompose into 4 slices + persistence service |
| 3 | [`frontend/features/preferences/components/PreferencesModal.tsx`](../../frontend/features/preferences/components/PreferencesModal.tsx) | **716** | Modal View | High | Extract `usePreferencesDraft` hook + tab view |
| 4 | [`frontend/features/virtual-mr/components/VirtualMrHub.tsx`](../../frontend/features/virtual-mr/components/VirtualMrHub.tsx) | **704** | Feature Hub | High | Extract Header, MetadataBar, Overview & Commits tabs |
| 5 | [`frontend/features/virtual-mr/components/NewVirtualMrView.tsx`](../../frontend/features/virtual-mr/components/NewVirtualMrView.tsx) | **664** | Form View | High | Extract Header, FormSection, CommitsList |
| 6 | [`frontend/features/ai/components/AiMcpTab.tsx`](../../frontend/features/ai/components/AiMcpTab.tsx) | **661** | Feature Tab | Medium | Extract modal state hook + sub-views |
| 7 | [`frontend/features/virtual-mr/components/VirtualMrListDialog.tsx`](../../frontend/features/virtual-mr/components/VirtualMrListDialog.tsx) | **642** | Dialog View | Medium | Extract SearchBox, ListItem row, PaginationBar |
| 8 | [`frontend/features/git/components/CloneRepoModal.tsx`](../../frontend/features/git/components/CloneRepoModal.tsx) | **612** | Modal View | Medium | Extract UrlValidation, DestinationPicker, Credentials |
| 9 | [`frontend/features/git/components/repository-settings/RepositoryAgentsTab.tsx`](../../frontend/features/git/components/repository-settings/RepositoryAgentsTab.tsx) | **609** | Feature Tab | Medium | Extract CustomBotModal, CustomRulesSection |
| 10 | [`frontend/common/components/MarkdownEditor.tsx`](../../frontend/common/components/MarkdownEditor.tsx) | **601** | Common Component | High | Extract Toolbar, MentionPopup, ImageDrop hook |
| 11 | [`frontend/features/virtual-mr/components/DiscussionThread.tsx`](../../frontend/features/virtual-mr/components/DiscussionThread.tsx) | **596** | Component | Medium | Extract CommentItem, ReplyForm, author utils |
| 12 | [`frontend/features/git/components/BlameViewer.tsx`](../../frontend/features/git/components/BlameViewer.tsx) | **581** | Viewer Component | High | Extract Toolbar, CommitDetailModal, LinesTable |
| 13 | [`frontend/features/credentials/components/GitCredentialsTab.tsx`](../../frontend/features/credentials/components/GitCredentialsTab.tsx) | **570** | Feature Tab | Medium | Extract VaultBanner, CredentialItem, AddModal |
| 14 | [`frontend/core/components/layout/MainLayout.tsx`](../../frontend/core/components/layout/MainLayout.tsx) | **535** | App Layout | Medium | Extract ModalsContainer, SplitterCoordinator |
| 15 | [`frontend/features/git/components/GitGraphModal.tsx`](../../frontend/features/git/components/GitGraphModal.tsx) | **490** | Modal View | Medium | Extract GraphCanvas, GraphControls |
| 16 | [`frontend/features/ai/components/BotReviewerModal.tsx`](../../frontend/features/ai/components/BotReviewerModal.tsx) | **481** | Modal View | Medium | Extract PromptConfigForm, CategorySelector |
| 17 | [`frontend/features/git/components/GitBinaryTab.tsx`](../../frontend/features/git/components/GitBinaryTab.tsx) | **461** | Feature Tab | Medium | Extract BinaryDetectionCard, BinaryListTable |
| 18 | [`frontend/core/components/layout/menu-bar/MenuBarRepositoryMenu.tsx`](../../frontend/core/components/layout/menu-bar/MenuBarRepositoryMenu.tsx) | **457** | Menu Dropdown | Medium | Extract RecentReposSubmenu, GitActionsSubmenu |
| 19 | [`frontend/features/git/components/ConflictViewer.tsx`](../../frontend/features/git/components/ConflictViewer.tsx) | **448** | Viewer Component | High | Extract ConflictPane, ConflictResolutionBar |
| 20 | [`frontend/features/ai/components/AiMcpProviderDetailsModal.tsx`](../../frontend/features/ai/components/AiMcpProviderDetailsModal.tsx) | **437** | Modal View | Medium | Extract ProviderEndpointForm, ModelListTable |
| 21 | [`frontend/features/git/components/FileList.tsx`](../../frontend/features/git/components/FileList.tsx) | **425** | Sidebar View | Medium | Extract FileTreeItem, FileListFilterBar |
| 22 | [`frontend/features/ai/components/SandboxTab.tsx`](../../frontend/features/ai/components/SandboxTab.tsx) | **408** | Feature Tab | Medium | Extract SandboxInstanceCard, SandboxConfigForm |
| 23 | [`frontend/features/ai/components/ExternalAgentsTab.tsx`](../../frontend/features/ai/components/ExternalAgentsTab.tsx) | **402** | Feature Tab | Medium | Extract AcpAgentCard, AcpAgentModalForm |
| 24 | [`frontend/features/virtual-mr/store/useVirtualMrStore.ts`](../../frontend/features/virtual-mr/store/useVirtualMrStore.ts) | **401** | Zustand Store | Low | Already sliced; finish moving remaining root actions |

---

## 3. Detailed Architectural Blueprints for Priority Targets

### Tier 1: Giant Zustand Stores (Highest Priority)

#### 1. `frontend/features/git/store/useGitStore.ts` (895 lines → ~90 lines facade)
- **Current Problem**: Acts as the central "god-store" combining repository lifecycles, branch comparisons, diff payloads, merge/rebase conflict reports, blame data, sandbox execution, and UI dialog toggles.
- **Decomposition Structure**:
  - `frontend/features/git/store/slices/createGitRepoSlice.ts`: Repository open, recent repos, validate, clone, and native menu synchronization.
  - `frontend/features/git/store/slices/createGitDiffSlice.ts`: Base/compare branches, diff payload fetch, file selection, split/unified view mode.
  - `frontend/features/git/store/slices/createGitConflictBlameSlice.ts`: Conflict detection, in-memory merge reports, blame payload, line highlights.
  - `frontend/features/git/store/slices/createGitSandboxSlice.ts`: Sandbox types (in-memory, docker), adapter info, instances, execution status.
  - `frontend/features/git/store/slices/createGitUiModalsSlice.ts`: Booleans and toggles for `isPullFromOpen`, `isMergeFromOpen`, `isRebaseFromOpen`, `isGitGraphOpen`, `isCloneModalOpen`, `isRemoteUrlFromOpen`, toast notifications.
  - `frontend/features/git/store/useGitStore.ts`: Re-export facade combining all slices with `create<GitState>((...a) => ({ ...createGitRepoSlice(...a), ... }))`.
- **Contract Guarantee**: `useGitStore` type signature and all selectors remain 100% backward-compatible. No consumer components need import changes.

#### 2. `frontend/features/ai/store/useAiMcpStore.ts` (771 lines → ~90 lines facade)
- **Current Problem**: Mixes synchronous localStorage/preferences.json serialization, OS Keyring IPC (`store_ai_api_key`), MCP server runtime state, Guardrail audit logs, and ACP external agents.
- **Decomposition Structure**:
  - `frontend/features/ai/services/aiMcpPersistence.ts`: `loadPersistedState()` and `persistState()` with secret key zeroization/redaction and fallback handling.
  - `frontend/features/ai/store/slices/createAiConfigSlice.ts`: AI config (provider, model, baseUrl, reasoningEffort), API key keyring calls, dynamic model fetching.
  - `frontend/features/ai/store/slices/createMcpServersSlice.ts`: MCP server configs, verification status, enable/disable toggle, add/update/delete.
  - `frontend/features/ai/store/slices/createGuardrailsSlice.ts`: Guardrail policy, evaluation results, audit logs.
  - `frontend/features/ai/store/slices/createExternalAgentsSlice.ts`: ACP agent configs and lifecycle updates.
  - `frontend/features/ai/store/useAiMcpStore.ts`: Root facade combining slices.

---

### Tier 2: Large Views & Modals (600 – 720 lines)

#### 3. `frontend/features/preferences/components/PreferencesModal.tsx` (716 lines → ~150 lines)
- **Current Problem**: Holds 16+ separate `useState` hooks for font, theme, diff, blame, and sandbox draft values, along with 80+ lines of effect synchronization on modal open/close.
- **Decomposition Structure**:
  - `frontend/features/preferences/hooks/usePreferencesDraft.ts`: Encapsulates all draft state, baseline comparison, change counters, reset to default, and commit actions.
  - `frontend/features/preferences/components/PreferencesTabContainer.tsx`: Renders the active category tab (General, Theme, Font, Diff, AI Overview, Git Binary, Credentials, etc.).
  - `PreferencesModal.tsx`: Pure layout shell containing TopBar, NavTree, TabContainer, and Footer.

#### 4. `frontend/features/virtual-mr/components/VirtualMrHub.tsx` (704 lines → ~120 lines)
- **Current Problem**: Renders the complete MR detail view including the top action header, metadata pills/popovers, and embedded sub-tabs.
- **Decomposition Structure**:
  - `frontend/features/virtual-mr/components/hub/VirtualMrHeader.tsx`: Title inline editor, friendly MR ID badge (`!{n}`), status badge, TabBranchSelector source/target, and AI Review trigger button.
  - `frontend/features/virtual-mr/components/hub/VirtualMrMetadataBar.tsx`: Assignee badge, Reviewers bot popover list, Labels popover list, and sub-tab navigation buttons (`overview`, `commits`, `diff`).
  - `frontend/features/virtual-mr/components/hub/VirtualMrOverviewTab.tsx`: Description markdown preview/editor and discussion board.
  - `frontend/features/virtual-mr/components/hub/VirtualMrCommitsTab.tsx`: List of commits between source and target branches.
  - `VirtualMrHub.tsx`: Integrates the header, metadata bar, and tab panels.

#### 5. `frontend/features/virtual-mr/components/NewVirtualMrView.tsx` (664 lines → ~140 lines)
- **Current Problem**: Large creation form containing branch comparison, metadata inputs, and diff previews.
- **Decomposition Structure**:
  - `frontend/features/virtual-mr/components/new-mr/NewVirtualMrHeader.tsx`: Branch selectors, swap button, conflict warning badge.
  - `frontend/features/virtual-mr/components/new-mr/NewVirtualMrFormSection.tsx`: Title input, description markdown editor, AI generate draft button.
  - `frontend/features/virtual-mr/components/new-mr/NewVirtualMrCommitsList.tsx`: Commit comparison table.

#### 6. `frontend/features/virtual-mr/components/VirtualMrListDialog.tsx` (642 lines → ~150 lines)
- **Current Problem**: Contains complex search query tokenization, suggestion dropdown keyboard handlers, row items, and pagination controls.
- **Decomposition Structure**:
  - `frontend/features/virtual-mr/components/list/VirtualMrSearchBox.tsx`: Search input with token parsing and suggestion dropdown listbox.
  - `frontend/features/virtual-mr/components/list/VirtualMrListItem.tsx`: Single MR list item row (title, status badge, avatar, friendly ID, branch arrows).
  - `frontend/features/virtual-mr/components/list/VirtualMrPaginationToolbar.tsx`: Page size dropdown, previous/next buttons, and status indicator.

---

### Tier 3: Feature Components & Viewers (500 – 612 lines)

#### 7. `frontend/common/components/MarkdownEditor.tsx` (601 lines → ~160 lines)
- **Decomposition Structure**:
  - `frontend/common/components/markdown-editor/MarkdownToolbar.tsx`: Formatting actions (Bold, Italic, Heading, Code, Quote, List).
  - `frontend/common/components/markdown-editor/MarkdownMentionPopup.tsx`: Popover listbox for `@mention` completion.
  - `frontend/common/components/markdown-editor/useMarkdownImageDrop.ts`: Hook handling drag & drop and clipboard paste for image uploads.
  - `frontend/common/components/markdown-editor/MarkdownFooterActions.tsx`: Submit, Cancel, and AI Draft buttons.

#### 8. `frontend/features/git/components/CloneRepoModal.tsx` (612 lines → ~150 lines)
- **Decomposition Structure**:
  - `frontend/features/git/components/clone/CloneUrlInputSection.tsx`: URL field, validation status indicator, remote ref inspection.
  - `frontend/features/git/components/clone/CloneDestinationSection.tsx`: Directory picker and destination path preview.
  - `frontend/features/git/components/clone/CloneCredentialsSection.tsx`: Saved credentials dropdown.

#### 9. `frontend/features/git/components/BlameViewer.tsx` (581 lines → ~140 lines)
- **Decomposition Structure**:
  - `frontend/features/git/components/blame/BlameToolbar.tsx`: Revision dropdown, whitespace toggle, search filter, contributor stats toggle.
  - `frontend/features/git/components/blame/BlameCommitDetailModal.tsx`: Popup showing commit hash, author, date, subject, and copy link.
  - `frontend/features/git/components/blame/BlameLinesTable.tsx`: Virtualized/tabular lines with author gutter and code content.

#### 10. `frontend/features/git/components/repository-settings/RepositoryAgentsTab.tsx` (609 lines → ~130 lines)
- **Decomposition Structure**:
  - `frontend/features/git/components/repository-settings/RepositoryCustomRulesSection.tsx`: Custom rules textarea with quick snippet pills.
  - `frontend/features/git/components/repository-settings/RepositoryCustomBotForm.tsx`: Form for creating custom repository reviewer bots.
  - `frontend/features/git/components/repository-settings/RepositoryBotItem.tsx`: Individual bot card toggle.

#### 11. `frontend/features/virtual-mr/components/DiscussionThread.tsx` (596 lines → ~150 lines)
- **Decomposition Structure**:
  - `frontend/features/virtual-mr/utils/discussionAuthorUtils.ts`: `getAuthorHandle` and `getAuthorBadges`.
  - `frontend/features/virtual-mr/components/discussion/DiscussionCommentCard.tsx`: Comment rendering with avatar, badges, quote action.
  - `frontend/features/virtual-mr/components/discussion/DiscussionReplyBox.tsx`: Reply editor and resolution toggle.

#### 12. `frontend/features/credentials/components/GitCredentialsTab.tsx` (570 lines → ~140 lines)
- **Decomposition Structure**:
  - `frontend/features/credentials/components/GitCredentialsVaultBanner.tsx`: OS vault information banner.
  - `frontend/features/credentials/components/GitCredentialCard.tsx`: Saved credential entry item with copy/verify/delete actions.
  - `frontend/features/credentials/components/AddGitCredentialModal.tsx`: Modal for adding new PAT/Password/SSH credentials.

---

## 4. Invariants & Refactoring Contracts for Incoming Agents

1. **Preserve External API & Facades**:
   - Every decomposed store MUST retain its root hook export (`useGitStore`, `useAiMcpStore`) with identical selector signatures and return values.
   - Every decomposed component MUST retain its root exported component name and prop types (`AiMcpTabProps`, `VirtualMrListDialogProps`, etc.).
2. **Single Source Ownership**:
   - Each newly created file must define at most **one** React component or **one** TypeScript type owner. Pure helper functions (lowercase name) do not count as owners.
   - Enforce via: `node scripts/check-source-ownership.mjs`.
3. **No File Beyond Budget**:
   - All newly created files should aim for ~100–300 lines. None may exceed 450 lines.
4. **Platform & Line Ending Safety**:
   - On Windows, ensure files are treated consistently with CRLF/LF line endings.
   - When editing files, prefer matching single-line targets to avoid whitespace/CRLF mismatch errors.
5. **No Regressions in Unit Tests**:
   - Always run the relevant test suite before and after modifying a feature:
     ```powershell
     node --test scripts/virtual-mr-branch-lock.test.mjs scripts/virtual-mr-discussions.test.mjs scripts/virtual-mr-metadata.test.mjs scripts/virtual-mr-pagination.test.mjs scripts/virtual-mr-sequence.test.mjs
     ```

---

## 5. Phased Execution Roadmap

```mermaid
flowchart LR
    Phase1["Wave 1 (Stores)<br/>useGitStore<br/>useAiMcpStore"] --> Phase2["Wave 2 (Views)<br/>PreferencesModal<br/>VirtualMrHub<br/>NewVirtualMrView<br/>VirtualMrListDialog"] --> Phase3["Wave 3 (Components)<br/>MarkdownEditor<br/>CloneRepoModal<br/>BlameViewer<br/>DiscussionThread<br/>GitCredentialsTab"]
```

### Execution Checklist for Next Agent:
- [x] **Wave 1: Zustand Slices**
  - [x] Split `useGitStore.ts` into 5 domain slices plus a dedicated sync slice in `features/git/store/slices/`.
  - [x] Split `useAiMcpStore.ts` into 4 domain slices + `aiMcpPersistence.ts`.
  - [x] Verify `pnpm typecheck` and `pnpm check:architecture`.
- [x] **Wave 2: Complex Views**
  - [x] Extract `usePreferencesDraft` from `PreferencesModal.tsx`.
  - [x] Extract `VirtualMrHeader`, `VirtualMrMetadataBar`, and sub-tabs from `VirtualMrHub.tsx`.
  - [x] Extract `NewVirtualMrHeader` and form sections from `NewVirtualMrView.tsx`.
  - [x] Extract `VirtualMrSearchBox` and `VirtualMrListItem` from `VirtualMrListDialog.tsx`.
- [x] **Wave 3: Feature Modals & Viewers**
  - [x] Extract `MarkdownToolbar` and `useMarkdownImageDrop` from `MarkdownEditor.tsx`.
  - [x] Extract `CloneUrlInputSection` and `CloneDestinationSection` from `CloneRepoModal.tsx`.
  - [x] Extract `BlameToolbar` and `BlameLinesTable` from `BlameViewer.tsx`.
  - [x] Extract `DiscussionCommentCard` and `DiscussionReplyBox` from `DiscussionThread.tsx`.
  - [x] Extract `AddGitCredentialModal` and `GitCredentialCard` from `GitCredentialsTab.tsx`.

---

## 6. Verification Commands

Run after completing any refactoring step:

```powershell
# 1. Check architecture and source ownership limits
pnpm check:architecture

# 2. Check TypeScript types
pnpm typecheck

# 3. Check virtual MR and feature tests
node --test scripts/virtual-mr-branch-lock.test.mjs scripts/virtual-mr-discussions.test.mjs scripts/virtual-mr-metadata.test.mjs scripts/virtual-mr-pagination.test.mjs scripts/virtual-mr-sequence.test.mjs

# 4. Check backend Cargo compilation (if any types or IPC schemas were touched)
cargo check --manifest-path backend/Cargo.toml
```

---

## 7. Implementation checkpoint (2026-10-22)

All three execution waves and all 24 inventory targets have been addressed. The
frontend now has **693 TypeScript files**, largest **445/450 physical lines**;
only **5** files remain at or above the 400-line review threshold (previously 24).
There are no size exceptions. Root hooks and component exports remain stable.

| Original target | Before | After |
|---|---:|---:|
| [features/git/store/useGitStore.ts](../../frontend/features/git/store/useGitStore.ts) | 895 | 18 |
| [features/ai/store/useAiMcpStore.ts](../../frontend/features/ai/store/useAiMcpStore.ts) | 771 | 72 |
| [features/preferences/components/PreferencesModal.tsx](../../frontend/features/preferences/components/PreferencesModal.tsx) | 716 | 190 |
| [features/virtual-mr/components/VirtualMrHub.tsx](../../frontend/features/virtual-mr/components/VirtualMrHub.tsx) | 704 | 334 |
| [features/virtual-mr/components/NewVirtualMrView.tsx](../../frontend/features/virtual-mr/components/NewVirtualMrView.tsx) | 664 | 429 |
| [features/ai/components/AiMcpTab.tsx](../../frontend/features/ai/components/AiMcpTab.tsx) | 661 | 338 |
| [features/virtual-mr/components/VirtualMrListDialog.tsx](../../frontend/features/virtual-mr/components/VirtualMrListDialog.tsx) | 642 | 426 |
| [features/git/components/CloneRepoModal.tsx](../../frontend/features/git/components/CloneRepoModal.tsx) | 612 | 240 |
| [features/git/components/repository-settings/RepositoryAgentsTab.tsx](../../frontend/features/git/components/repository-settings/RepositoryAgentsTab.tsx) | 609 | 386 |
| [common/components/MarkdownEditor.tsx](../../frontend/common/components/MarkdownEditor.tsx) | 601 | 291 |
| [features/virtual-mr/components/DiscussionThread.tsx](../../frontend/features/virtual-mr/components/DiscussionThread.tsx) | 596 | 308 |
| [features/git/components/BlameViewer.tsx](../../frontend/features/git/components/BlameViewer.tsx) | 581 | 226 |
| [features/credentials/components/GitCredentialsTab.tsx](../../frontend/features/credentials/components/GitCredentialsTab.tsx) | 570 | 263 |
| [core/components/layout/MainLayout.tsx](../../frontend/core/components/layout/MainLayout.tsx) | 535 | 184 |
| [features/git/components/GitGraphModal.tsx](../../frontend/features/git/components/GitGraphModal.tsx) | 490 | 157 |
| [features/ai/components/BotReviewerModal.tsx](../../frontend/features/ai/components/BotReviewerModal.tsx) | 481 | 321 |
| [features/git/components/GitBinaryTab.tsx](../../frontend/features/git/components/GitBinaryTab.tsx) | 461 | 344 |
| [core/components/layout/menu-bar/MenuBarRepositoryMenu.tsx](../../frontend/core/components/layout/menu-bar/MenuBarRepositoryMenu.tsx) | 457 | 323 |
| [features/git/components/ConflictViewer.tsx](../../frontend/features/git/components/ConflictViewer.tsx) | 448 | 378 |
| [features/ai/components/AiMcpProviderDetailsModal.tsx](../../frontend/features/ai/components/AiMcpProviderDetailsModal.tsx) | 437 | 344 |
| [features/git/components/FileList.tsx](../../frontend/features/git/components/FileList.tsx) | 425 | 342 |
| [features/ai/components/SandboxTab.tsx](../../frontend/features/ai/components/SandboxTab.tsx) | 408 | 311 |
| [features/ai/components/ExternalAgentsTab.tsx](../../frontend/features/ai/components/ExternalAgentsTab.tsx) | 402 | 422 |
| [features/virtual-mr/store/useVirtualMrStore.ts](../../frontend/features/virtual-mr/store/useVirtualMrStore.ts) | 401 | 19 |

### Boundary decisions

- Git uses six slices rather than five: sync is an independent bounded workflow,
  separate from repository lifecycle. Its shared diff invalidation epoch remains
  shared with lifecycle operations. AI uses four slices and a persistence service.
- Preferences additionally separates the ordered Apply action from draft state.
  AI tab state separates MCP form/secret validation from provider coordination.
- Existing graph, tree, reviewer/label and endpoint components were reused where
  already separated. Smaller inventory targets received named functional extracts
  (binary table/detection, file filters, conflict controls, sandbox and ACP cards,
  repository sync/open submenus), not duplicate versions of existing controls.
- Component props have separate owners. React map keys remain at caller sites.
  New view boundaries retain callbacks, refs, conditional mounting and consent.
- Root line-count sketches were estimates, not reasons to fragment cohesive
  orchestration further. Every production file is under the enforced 450 limit.

### Verification and known failures

- `pnpm typecheck`, `pnpm check:architecture`, `git diff --check` and
  `cargo check --manifest-path backend/Cargo.toml` pass.
- Full Node baseline: **181 total / 163 pass / 18 fail**. After refactor: **185
  total / 167 pass / the same 18 fail**. No new failing test names. Existing
  assertions were retained; source-layout assertions now read the implementation
  owner and fixture loaders resolve canonical module identities/automatic JSX.
- Four new tests cover physical-line enforcement, lifecycle/diff invalidation,
  overlapping diff requests, and AI/MCP secret persistence. All pass.
- An additional AST audit compared all **155** original Git/AI/MR root state
  fields and actions with their extracted implementations; no implementation
  differences after shared-epoch-name and formatting normalization.
- Isolated Vite production compilation passes without version/release metadata
  changes. Mixed static/dynamic imports and large-chunk warnings remain.
- No backend behavior or IPC schema changes. Verification ran on macOS; native
  visual interactions, real accounts/providers and Windows/Linux runtime behavior
  have not been exercised. The 18 baseline failures remain visible follow-up work,
  not a claim that the entire suite is green.

Current responsibilities, invariants and failure groups are documented in
[frontend maintenance](frontend_maintenance.md). `AGENTS.md` and
`.cursor/rules/frontend-modularity.mdc` direct future agents there.

## 8. TS/TSX follow-up checkpoint (2026-10-22)

User scope: address all remaining large/complex TypeScript targets, excluding
stylesheets. The section 7 measurements are historical, not the current inventory.
All **30** files at 300+ lines in the follow-up baseline were addressed, alongside
the densely packed review panel. No stylesheet or backend source was changed.

| Measurement | Follow-up baseline | After |
|---|---:|---:|
| TS/TSX files | 693 | 794 |
| Physical lines | 44,617 | 47,425 |
| Largest file | 445 | 299 |
| Files at 400+ | 5 | 0 |
| Files at 300–399 | 25 | 0 |

The extra files are named workflow hooks, action/transport/persistence helpers,
view sections and their separate props/context types. Healthy small modules were
not rewritten. The architecture limit remains 450; it was not raised or bypassed.

| Follow-up priority | Before | After |
|---|---:|---:|
| `useAiMcpTabState.ts` | 445 | 246 |
| `usePreferencesDraft.ts` | 445 | 292 |
| `NewVirtualMrView.tsx` | 429 | 270 |
| `VirtualMrListDialog.tsx` | 426 | 297 |
| `ExternalAgentsTab.tsx` | 422 | 285 |
| `RepositoryAgentsTab.tsx` | 386 | 259 |
| `createAiConfigSlice.ts` | 378 | 265 |
| `useCloneRepository.ts` | 355 | 260 |
| `BotReviewersTab.tsx` | 347 | 280 |
| `useGitGraphState.ts` | 338 | 177 |
| `PreferencesJsonEditor.tsx` | 330 | 202 |
| `BotReviewerModal.tsx` | 321 | 275 |
| `AcpAgentDetails.tsx` | 357 | 104 |
| `ReviewPanel.tsx` | 164 (dense) | 240 (readable orchestration) |

### Responsibilities and compatibility

- Provider setup/removal/details, ACP account/prompt/custom registration, MR
  search/pagination/metadata, clone refs/destination and graph search/details each
  have an owning workflow. Request epochs, cleanup, native paths and effect order
  remain with their original workflows.
- Preferences separates draft-session lifecycle, navigation and dirty counts
  from transaction coordination. JSONC separates document persistence/conflicts
  from code-buffer/completion interactions. Apply/OK/Cancel ordering is unchanged.
- Global/repo bot forms use feature-owned draft models and a generic field-update
  hook. Reviewer model catalog/capability resolution is separate from saving.
  Internal bot/ACP props are grouped by dialog/identity/execution/catalog or
  project/account/prompt/dialog, with all application callers migrated together.
  Store selector APIs, IPC names/payloads, events and exported entry-point names
  remain stable; no external SDK contract is introduced.
- Clone/file-selection and session-reviewer/draft-submission action factories
  share the existing stores' set/get. Reviewer normalization/persistence and
  provider connection transport are services, not new stores.
- Named views now own conflict block/marker rendering, flat/folder lists, binary
  custom entry, pull options, repo inheritance, repository merge/rebase submenus,
  review configuration/results and ACP detail sections. React keys remain at the
  same mapped caller level; focus/refs/consent and conditional mounting are kept.
- AI/native/ACP guardrails, source-transfer consent, snapshots and backend
  evidence/publication checks were not loosened. Review UI extraction is not new
  authority for an external agent.

### Verification

- Typecheck, architecture checks, Cargo check, isolated Vite bundle compilation
  and whitespace checks pass. Normal packaging/version-bumping scripts were not
  used. Existing large-chunk and mixed import warnings remain.
- Full Node baseline: **185 / 167 pass / 18 fail**. Final: **192 / 174 pass /
  the same 18 fail**, with no added failing test names. Seven added tests cover
  form updates, reviewer capabilities/consent, clone stale results, ACP account
  lifecycle, graph lanes, draft-session lifecycle and saved-key transport.
- Existing assertions were retained. Clone source-layout assertions follow the
  extracted destination owner. The unchanged failure groups are listed in the
  [maintenance checkpoint](frontend_maintenance.md#latest-verification-checkpoint-2026-10-22-tstsx-follow-up).
- An AST comparison confirmed **98** existing state fields/actions unchanged
  after ignoring parentheses/formatting. Provider connection checking is the one
  delegated action; its native saved-key/request contract is tested directly.
- macOS checks only: no Windows/Linux runtime, live account/provider calls or
  native visual interaction QA. These checks reduce regression risk; they do not
  claim that the pre-existing failures are fixed or every runtime path was tested.

Use the updated [maintenance map](frontend_maintenance.md) to locate owners. Keep
structural moves separate from behavior changes and preserve all listed safety
and transaction contracts when extending these workflows.
