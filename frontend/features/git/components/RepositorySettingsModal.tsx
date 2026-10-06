import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Globe,
  GitBranch,
  Tag,
  Bookmark,
  Bot,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Check,
  AlertCircle,
  Shield,
  Sparkles,
  FolderCog,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from '@/common/components/icons';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { BOT_CATEGORIES } from '../../ai/constants/botPresets';
import { BotCategory } from '../../virtual-mr/types/virtualMr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'remotes' | 'branches' | 'labels' | 'agents';
}

export const RepositorySettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialTab = 'remotes',
}) => {
  const {
    currentRepo,
    branches,
    fetchBranches,
    showToast,
  } = useGitStore();

  const {
    repoSettings,
    repoLabels,
    remotesDetailed,
    tags,
    saveRepoSettings,
    addRemote,
    removeRemote,
    setRemoteUrl,
    testRemote,
    createTag,
    deleteTag,
    createBranch,
    deleteBranch,
    createRepoLabel,
    updateRepoLabel,
    deleteRepoLabel,
    loadPresetLabels,
  } = useVirtualMrStore();

  const { setIsPreferencesOpen } = usePreferencesStore();
  const {
    globalReviewers,
    repoActiveBotIds,
    repoCustomReviewers,
    toggleRepoActiveBotId,
    addRepoCustomReviewer,
    deleteRepoCustomReviewer,
    resetRepoToGlobal,
  } = useBotReviewersStore();

  const [activeTab, setActiveTab] = useState<'remotes' | 'branches' | 'labels' | 'agents'>(
    initialTab
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Form states
  const [testingRemoteName, setTestingRemoteName] = useState<string | null>(null);
  const [remoteTestResult, setRemoteTestResult] = useState<{
    [name: string]: { success: boolean; message: string };
  }>({});

  // Add Remote
  const [isAddingRemote, setIsAddingRemote] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');

  // Edit Remote URL
  const [editingRemoteName, setEditingRemoteName] = useState<string | null>(null);
  const [editingRemoteUrl, setEditingRemoteUrl] = useState('');

  // Add Tag
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');

  // Add Branch
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBase, setNewBranchBase] = useState('HEAD');

  // Add / Edit Label
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelFormName, setLabelFormName] = useState('');
  const [labelFormColor, setLabelFormColor] = useState('#3b82f6');
  const [labelFormDesc, setLabelFormDesc] = useState('');

  // AI Rules & Bot Reviewers State
  const [customRules, setCustomRules] = useState(repoSettings?.customAgentRules || '');
  const [inheritAgents, setInheritAgents] = useState(repoSettings?.inheritGlobalAgents ?? true);
  const [defaultBaseBranch, setDefaultBaseBranch] = useState(repoSettings?.defaultBaseBranch || 'main');

  // Repo Custom Bot Creation State
  const [isAddingRepoBot, setIsAddingRepoBot] = useState(false);
  const [repoBotName, setRepoBotName] = useState('');
  const [repoBotTagline, setRepoBotTagline] = useState('');
  const [repoBotDesc, setRepoBotDesc] = useState('');
  const [repoBotCategory, setRepoBotCategory] = useState<BotCategory>('custom');
  const [repoBotEmoji, setRepoBotEmoji] = useState('🤖');
  const [repoBotPrompt, setRepoBotPrompt] = useState('');

  const currentRepoId = currentRepo?.id || '';

  const activeBotSet = useMemo(() => {
    const list = repoActiveBotIds[currentRepoId] ?? globalReviewers.filter((b) => b.enabled).map((b) => b.id);
    return new Set(list);
  }, [repoActiveBotIds, currentRepoId, globalReviewers]);

  const repoExclusiveBots = repoCustomReviewers[currentRepoId] || [];

  const RULE_SNIPPETS = [
    { label: 'Strict TypeScript', text: 'Enforce strict TypeScript: reject "any", require return types, verify exhaustive union checks.' },
    { label: 'Security & OWASP', text: 'Sanitize external inputs against SQLi/XSS, verify auth tokens on mutation endpoints, no secrets in logs.' },
    { label: 'Performance', text: 'Flag potential N+1 database queries, verify pagination on large listings, check for redundant re-renders.' },
    { label: 'Clean Architecture', text: 'Enforce SOLID principles, keep business domain decoupled from transport/DB, no circular imports.' },
    { label: 'Unit Test Coverage', text: 'Ensure every new feature or bug fix includes corresponding automated tests with edge assertions.' },
  ];

  const handleAppendSnippet = (text: string) => {
    setCustomRules((prev) => (prev.trim() ? `${prev.trim()}\n\n- ${text}` : `- ${text}`));
  };

  const handleSaveRepoCustomBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoBotName.trim() || !repoBotPrompt.trim() || !currentRepoId) return;

    addRepoCustomReviewer(currentRepoId, {
      name: repoBotName.trim(),
      tagline: repoBotTagline.trim(),
      description: repoBotDesc.trim(),
      category: repoBotCategory,
      avatarEmoji: repoBotEmoji,
      systemPrompt: repoBotPrompt.trim(),
      enabled: true,
      isBuiltin: false,
    });

    setIsAddingRepoBot(false);
    setRepoBotName('');
    setRepoBotTagline('');
    setRepoBotDesc('');
    setRepoBotCategory('custom');
    setRepoBotEmoji('🤖');
    setRepoBotPrompt('');
    showToast(`Added repo reviewer: ${repoBotName.trim()}`);
  };

  useEffect(() => {
    if (repoSettings) {
      setCustomRules(repoSettings.customAgentRules || '');
      setInheritAgents(repoSettings.inheritGlobalAgents);
      setDefaultBaseBranch(repoSettings.defaultBaseBranch || 'main');
    }
  }, [repoSettings]);

  if (!isOpen || !currentRepo) return null;

  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
  ];

  const handleTestRemote = async (name: string, _url?: string) => {
    setTestingRemoteName(name);
    try {
      const res = await testRemote(name);
      if (res.toLowerCase().includes('no repo open') || res.toLowerCase().includes('fail') || res.toLowerCase().includes('error')) {
        setRemoteTestResult((prev) => ({
          ...prev,
          [name]: { success: false, message: res },
        }));
        showToast(`Test ${name}: Connection failed`);
      } else {
        setRemoteTestResult((prev) => ({
          ...prev,
          [name]: { success: true, message: res },
        }));
        showToast(`Test ${name}: Connection successful`);
      }
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      setRemoteTestResult((prev) => ({
        ...prev,
        [name]: { success: false, message: errMsg.startsWith('Error:') ? errMsg : `Error: ${errMsg}` },
      }));
      showToast(`Test ${name}: Connection failed`);
    } finally {
      setTestingRemoteName(null);
    }
  };

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
    try {
      await addRemote(newRemoteName.trim(), newRemoteUrl.trim());
      showToast(`Remote added: ${newRemoteName}`);
      setNewRemoteName('');
      setNewRemoteUrl('');
      setIsAddingRemote(false);
    } catch (err: any) {
      showToast(`Failed to add remote: ${err}`);
    }
  };

  const handleSaveRemoteUrl = async (name: string) => {
    if (!editingRemoteUrl.trim()) return;
    try {
      await setRemoteUrl(name, editingRemoteUrl.trim());
      showToast(`Updated remote URL: ${name}`);
      setEditingRemoteName(null);
    } catch (err: any) {
      showToast(`Failed to update URL: ${err}`);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await createTag(newTagName.trim(), 'HEAD', newTagMessage.trim() || undefined);
      showToast(`Tag created: ${newTagName}`);
      setNewTagName('');
      setNewTagMessage('');
      setIsAddingTag(false);
    } catch (err: any) {
      showToast(`Failed to create tag: ${err}`);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await createBranch(newBranchName.trim(), newBranchBase === 'HEAD' ? undefined : newBranchBase);
      await fetchBranches(currentRepo.local_path);
      showToast(`Branch created: ${newBranchName}`);
      setNewBranchName('');
      setIsAddingBranch(false);
    } catch (err: any) {
      showToast(`Failed to create branch: ${err}`);
    }
  };

  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelFormName.trim()) return;

    try {
      if (editingLabelId) {
        const existing = repoLabels.find((l) => l.id === editingLabelId);
        if (existing) {
          await updateRepoLabel({
            ...existing,
            name: labelFormName.trim(),
            color: labelFormColor,
            description: labelFormDesc.trim() || undefined,
          });
          showToast(`Label updated: ${labelFormName}`);
        }
        setEditingLabelId(null);
      } else {
        await createRepoLabel(labelFormName.trim(), labelFormColor, labelFormDesc.trim());
        showToast(`Label created: ${labelFormName}`);
        setIsAddingLabel(false);
      }
      setLabelFormName('');
      setLabelFormDesc('');
    } catch (err: any) {
      showToast(`Failed to save label: ${err}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await saveRepoSettings({
        defaultBaseBranch,
        inheritGlobalAgents: inheritAgents,
        customAgentRules: customRules,
      });
      showToast('Repository settings saved');
      onClose();
    } catch (err: any) {
      showToast(`Failed to save settings: ${err}`);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 w-full max-w-4xl h-[640px] shadow-2xl flex flex-col overflow-hidden text-text text-sm animate-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div
          data-tauri-drag-region
          className="px-6 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs">
              <FolderCog className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Repository Settings</h2>
              <p className="text-[11px] text-subtext0 font-mono mt-0.5">{currentRepo.name} ({currentRepo.local_path})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR TABS (Left) */}
          <div className="w-60 bg-base/40 border-r border-surface0 flex flex-col shrink-0 select-none">
            <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-subtext0/70 border-b border-surface0/40">
              Repository
            </div>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setActiveTab('remotes')}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all cursor-pointer border-l-2 ${
                  activeTab === 'remotes'
                    ? 'bg-brand/10 text-brand font-semibold border-l-brand'
                    : 'border-l-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 transition-colors ${
                    activeTab === 'remotes' ? 'text-brand' : 'text-subtext0'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">Remotes</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    Origin &amp; upstream URLs
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('branches')}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all cursor-pointer border-l-2 ${
                  activeTab === 'branches'
                    ? 'bg-brand/10 text-brand font-semibold border-l-brand'
                    : 'border-l-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 transition-colors ${
                    activeTab === 'branches' ? 'text-brand' : 'text-subtext0'
                  }`}
                >
                  <GitBranch className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">Branches &amp; Tags</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    Default base, tags &amp; branches
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('labels')}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all cursor-pointer border-l-2 ${
                  activeTab === 'labels'
                    ? 'bg-brand/10 text-brand font-semibold border-l-brand'
                    : 'border-l-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 transition-colors ${
                    activeTab === 'labels' ? 'text-brand' : 'text-subtext0'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium flex items-center justify-between">
                    <span>Labels</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface1 font-mono text-subtext1">
                      {repoLabels.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    Virtual MR classification
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all cursor-pointer border-l-2 ${
                  activeTab === 'agents'
                    ? 'bg-brand/10 text-brand font-semibold border-l-brand'
                    : 'border-l-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 transition-colors ${
                    activeTab === 'agents' ? 'text-brand' : 'text-subtext0'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">AI Reviewers</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    Bots &amp; prompt directives
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 p-6 overflow-y-auto bg-mantle">
            {/* TAB 1: REMOTES */}
            {activeTab === 'remotes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1rem] text-text font-medium">Git Remotes</h3>
                    <p className="text-xs text-subtext0 mt-0.5">
                      Manage remote servers for code synchronization (origin, upstream, forks)
                    </p>
                    <p className="text-[10px] text-subtext0 mt-1">
                      Embedded URL credentials are masked here. Use Git's credential helper; editing a masked URL requires re-entering any removed credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingRemote(true)}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer border border-surface2/40"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Add Remote</span>
                  </button>
                </div>

                {/* ADD REMOTE FORM */}
                {isAddingRemote && (
                  <form
                    onSubmit={handleAddRemote}
                    className="p-4 bg-crust border border-surface0 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-text">Add New Remote</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingRemote(false)}
                        className="text-subtext0 hover:text-text cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-subtext0 mb-1">Remote Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. upstream"
                          value={newRemoteName}
                          onChange={(e) => setNewRemoteName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] text-subtext0 mb-1">Remote URL (HTTPS or SSH)</label>
                        <input
                          type="text"
                          required
                          placeholder="https://github.com/org/repo.git"
                          value={newRemoteUrl}
                          onChange={(e) => setNewRemoteUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingRemote(false)}
                        className="px-3 py-1 rounded bg-surface0 hover:bg-surface1 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {/* REMOTES LIST */}
                <div className="space-y-3">
                  {remotesDetailed.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-surface0 text-subtext0 text-xs">
                      No remotes configured for this repository yet.
                    </div>
                  ) : (
                    remotesDetailed.map((rem) => (
                      <div
                        key={rem.name}
                        className="p-4 bg-crust border border-surface0 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{rem.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface0 font-mono text-subtext0">
                              {rem.name === 'origin' ? 'Default Origin' : 'Secondary'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTestRemote(rem.name, rem.fetch_url)}
                              disabled={testingRemoteName === rem.name}
                              className="px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-xs font-mono text-subtext0 hover:text-text transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${testingRemoteName === rem.name ? 'animate-spin' : ''}`}
                              />
                              <span>Test Ping</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRemoteName(rem.name);
                                setEditingRemoteUrl(rem.fetch_url);
                              }}
                              className="p-1 rounded hover:bg-surface1 text-subtext0 hover:text-text cursor-pointer"
                              title="Edit URL"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove remote '${rem.name}'?`)) {
                                  removeRemote(rem.name);
                                }
                              }}
                              className="p-1 rounded hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer"
                              title="Remove Remote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingRemoteName === rem.name ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={editingRemoteUrl}
                              onChange={(e) => setEditingRemoteUrl(e.target.value)}
                              className="flex-1 px-3 py-1 bg-surface0 border border-surface1 text-xs font-mono text-text focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRemoteUrl(rem.name)}
                              className="px-3 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRemoteName(null)}
                              className="px-2 py-1 bg-surface0 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-subtext0 font-mono space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-subtext1">Fetch:</span>
                              <span className="text-text select-all">{rem.fetch_url}</span>
                            </div>
                            {rem.push_url !== rem.fetch_url && (
                              <div className="flex items-center gap-2">
                                <span className="w-12 text-subtext1">Push:</span>
                                <span className="text-text select-all">{rem.push_url}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {remoteTestResult[rem.name] && (
                          <div
                            className={`p-2 text-[11px] font-mono flex items-center gap-2 ${
                              remoteTestResult[rem.name].success
                                ? 'bg-green-700 text-white'
                                : 'bg-[#8b0000] text-white'
                            }`}
                          >
                            {remoteTestResult[rem.name].success ? (
                              <Check className="w-3.5 h-3.5 text-white shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                            )}
                            <span className="text-white font-medium">
                              {remoteTestResult[rem.name].message}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: BRANCHES & TAGS */}
            {activeTab === 'branches' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[1rem] text-text font-medium">Branches &amp; Tags</h3>
                  <p className="text-xs text-subtext0 mt-0.5">
                    Manage default branch configuration, create new branches, and manage tags
                  </p>
                </div>

                {/* DEFAULT BASE BRANCH */}
                <div className="p-4 bg-crust border border-surface0 space-y-2">
                  <label className="block text-xs font-medium text-text">Default Base Branch for Virtual MR</label>
                  <p className="text-xs text-subtext0">
                    The default target branch automatically selected when opening a new Virtual MR in this repository.
                  </p>
                  <select
                    value={defaultBaseBranch}
                    onChange={(e) => setDefaultBaseBranch(e.target.value)}
                    className="mt-1 px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none focus:border-accent w-64"
                  >
                    {Array.from(new Set([...(branches?.local || []), ...(branches?.remote || [])])).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* BRANCHES MANAGEMENT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-subtext0" />
                      <span>Local Branches ({branches?.local.length || 0})</span>
                    </span>
                    <button
                      onClick={() => setIsAddingBranch(true)}
                      className="px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Branch</span>
                    </button>
                  </div>

                  {isAddingBranch && (
                    <form
                      onSubmit={handleCreateBranch}
                      className="p-3 bg-crust border border-surface0 flex items-center gap-2 text-xs"
                    >
                      <input
                        type="text"
                        required
                        placeholder="New branch name (e.g. feat/checkout)"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text focus:outline-none"
                      />
                      <select
                        value={newBranchBase}
                        onChange={(e) => setNewBranchBase(e.target.value)}
                        className="px-2 py-1.5 rounded bg-surface0 border border-surface1 text-text"
                      >
                        <option value="HEAD">From HEAD</option>
                        {(branches?.local || []).map((b) => (
                          <option key={b} value={b}>
                            From {b}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-brand hover:bg-brand/90 text-on-accent font-semibold cursor-pointer shadow-xs"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingBranch(false)}
                        className="px-2 py-1.5 rounded bg-surface0 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  <div className="max-h-40 overflow-y-auto divide-y divide-surface0 border border-surface0 bg-crust/50">
                    {(branches?.local || []).map((b) => (
                      <div key={b} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{b}</span>
                          {b === branches?.current && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface1 text-text font-mono border border-surface2/40">
                              current HEAD
                            </span>
                          )}
                          {b === defaultBaseBranch && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface1 text-subtext0 font-mono border border-surface2/40">
                              default base
                            </span>
                          )}
                        </div>
                        {b !== branches?.current && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete branch '${b}'?`)) {
                                deleteBranch(b, true);
                                fetchBranches(currentRepo.local_path);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer"
                            title="Delete branch"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* TAGS MANAGEMENT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-subtext0" />
                      <span>Release Tags ({tags.length})</span>
                    </span>
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create Tag</span>
                    </button>
                  </div>

                  {isAddingTag && (
                    <form
                      onSubmit={handleCreateTag}
                      className="p-3 bg-crust border border-surface0 space-y-2 text-xs"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Tag name (e.g. v1.0.0)"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Annotated message"
                          value={newTagMessage}
                          onChange={(e) => setNewTagMessage(e.target.value)}
                          className="px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingTag(false)}
                          className="px-3 py-1 rounded bg-surface0 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded bg-brand hover:bg-brand/90 text-on-accent font-semibold cursor-pointer shadow-xs"
                        >
                          Create Tag
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="max-h-40 overflow-y-auto divide-y divide-surface0 border border-surface0 bg-crust/50">
                    {tags.length === 0 ? (
                      <div className="p-4 text-center text-subtext0 text-xs">No tags found</div>
                    ) : (
                      tags.map((t) => (
                        <div key={t.name} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-medium text-text">{t.name}</span>
                            <span className="font-mono text-[11px] text-subtext0">{t.commit_hash}</span>
                            {t.message && <span className="text-subtext1 italic truncate max-w-xs">{t.message}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete tag '${t.name}'?`)) {
                                deleteTag(t.name);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer"
                            title="Delete tag"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LABELS */}
            {activeTab === 'labels' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1rem] text-text font-medium">Repository Labels</h3>
                    <p className="text-xs text-subtext0 mt-0.5">
                      Label taxonomy scoped specifically to this repository (separate from App Preferences)
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={loadPresetLabels}
                      className="shrink-0 whitespace-nowrap px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer border border-surface1"
                    >
                      Load Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLabelId(null);
                        setLabelFormName('');
                        setLabelFormDesc('');
                        setLabelFormColor('#3b82f6');
                        setIsAddingLabel(true);
                      }}
                      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer border border-surface2/40"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>New Label</span>
                    </button>
                  </div>
                </div>

                {/* ADD/EDIT LABEL FORM */}
                {(isAddingLabel || editingLabelId) && (
                  <form
                    onSubmit={handleSaveLabel}
                    className="p-4 bg-crust border border-surface0 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-text">
                        {editingLabelId ? 'Edit Label' : 'Create New Label'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingLabel(false);
                          setEditingLabelId(null);
                        }}
                        className="text-subtext0 hover:text-text cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-subtext0 mb-1">Label Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. priority-high"
                          value={labelFormName}
                          onChange={(e) => setLabelFormName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] text-subtext0 mb-1">Description</label>
                        <input
                          type="text"
                          placeholder="Describe the purpose of this label..."
                          value={labelFormDesc}
                          onChange={(e) => setLabelFormDesc(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* COLOR PICKER & PRESETS */}
                    <div>
                      <label className="block text-[11px] text-subtext0 mb-1.5">Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={labelFormColor}
                          onChange={(e) => setLabelFormColor(e.target.value)}
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {colorPresets.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setLabelFormColor(c)}
                              className="w-6 h-6 rounded-full border border-surface1 transition-transform hover:scale-110 cursor-pointer"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingLabel(false);
                          setEditingLabelId(null);
                        }}
                        className="px-3 py-1 rounded bg-surface0 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs"
                      >
                        Save Label
                      </button>
                    </div>
                  </form>
                )}

                {/* LABELS TABLE */}
                <section aria-label="Repository labels list" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-text">Labels</h4>
                    <span className="text-[11px] text-subtext0">
                      {repoLabels.length} {repoLabels.length === 1 ? 'label' : 'labels'}
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-surface0 bg-crust">
                    <table className="w-full table-fixed text-left">
                      <caption className="sr-only">Repository labels</caption>
                      <colgroup>
                        <col className="w-[34%]" />
                        <col className="w-[48%]" />
                        <col className="w-[18%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-base">
                        <tr className="border-b border-surface0 text-[10px] uppercase tracking-wide text-subtext0">
                          <th scope="col" className="px-3 py-2 font-medium">Label</th>
                          <th scope="col" className="px-3 py-2 font-medium">Description</th>
                          <th scope="col" className="px-2 py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface0">
                        {repoLabels.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-xs text-subtext0">
                              No repository labels yet. Create a label or load presets to get started.
                            </td>
                          </tr>
                        ) : (
                          repoLabels.map((lbl) => (
                            <tr key={lbl.id} className="hover:bg-surface0/40">
                              <td className="px-3 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    aria-hidden="true"
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: lbl.color }}
                                  />
                                  <span className="truncate text-xs font-medium text-text" title={lbl.name}>
                                    {lbl.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="block truncate text-[11px] text-subtext0" title={lbl.description || ''}>
                                  {lbl.description || '—'}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLabelId(lbl.id);
                                      setLabelFormName(lbl.name);
                                      setLabelFormColor(lbl.color);
                                      setLabelFormDesc(lbl.description || '');
                                      setIsAddingLabel(false);
                                    }}
                                    className="p-1.5 text-subtext0 hover:bg-surface1 hover:text-text cursor-pointer"
                                    title={`Edit ${lbl.name}`}
                                    aria-label={`Edit ${lbl.name}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteRepoLabel(lbl.id)}
                                    className="p-1.5 text-subtext0 hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                                    title={`Delete ${lbl.name}`}
                                    aria-label={`Delete ${lbl.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 4: AI REVIEWERS (REPO SCOPE) */}
            {activeTab === 'agents' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[1rem] text-text font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand" />
                    <span>Repository Bot Reviewers</span>
                  </h3>
                  <p className="text-xs text-subtext0 mt-0.5">
                    Configure which AI Reviewer bots analyze Virtual MRs, catch security vulnerabilities, and inspect code for this repository.
                  </p>
                </div>

                {/* INHERITANCE MODE SELECTOR CARDS */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Inherit Global (Default) */}
                  <div
                    onClick={() => setInheritAgents(true)}
                    className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between ${
                      inheritAgents
                        ? 'bg-brand/5 border-brand/60 shadow-xs'
                        : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="reviewer-inheritance"
                            checked={inheritAgents}
                            onChange={() => setInheritAgents(true)}
                            className="text-brand focus:ring-0 cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-text">
                            Inherit Global Preferences
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand/20 text-brand border border-brand/30">
                          Default
                        </span>
                      </div>
                      <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
                        Automatically inherits all active Bot Reviewers and AI model settings configured in App Preferences.
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
                      <span className="text-[11px] text-brand font-medium">
                        {globalReviewers.filter((b) => b.enabled).length} global bots active
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          setIsPreferencesOpen(true);
                        }}
                        className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer hover:underline"
                        title="Open App Preferences modal"
                      >
                        <span>Open Preferences</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Custom for this Repo */}
                  <div
                    onClick={() => setInheritAgents(false)}
                    className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between ${
                      !inheritAgents
                        ? 'bg-accent/5 border-accent/60 shadow-xs'
                        : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="reviewer-inheritance"
                            checked={!inheritAgents}
                            onChange={() => setInheritAgents(false)}
                            className="text-accent focus:ring-0 cursor-pointer"
                          />
                          <span className="font-semibold text-xs text-text">
                            Custom for this Repository
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface1 text-subtext0 border border-surface2">
                          Isolated
                        </span>
                      </div>
                      <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
                        Override active bots independently for this repository, or add repository-exclusive custom reviewer bots.
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
                      <span className="text-[11px] text-accent font-medium">
                        {activeBotSet.size} bots enabled for repo
                      </span>
                      {!inheritAgents && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetRepoToGlobal(currentRepoId);
                            showToast('Reset bot selections to global defaults');
                          }}
                          className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer"
                          title="Reset to global active selection"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOT ROSTER DISPLAY */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-subtext0" />
                      <span>
                        {inheritAgents
                          ? 'Inherited Reviewer Bots (Read-only)'
                          : 'Repository Reviewer Selection (Custom)'}
                      </span>
                    </span>

                    {!inheritAgents && (
                      <button
                        type="button"
                        onClick={() => setIsAddingRepoBot(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-text text-xs rounded transition-colors cursor-pointer border border-surface2/40"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Repo Bot</span>
                      </button>
                    )}
                  </div>

                  {/* FORM TO ADD REPO-EXCLUSIVE CUSTOM BOT */}
                  {isAddingRepoBot && !inheritAgents && (
                    <form
                      onSubmit={handleSaveRepoCustomBot}
                      className="p-4 bg-crust border border-accent/40 rounded space-y-3 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-accent" />
                          <span>Create Repo-Exclusive Reviewer Bot</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingRepoBot(false)}
                          className="text-subtext0 hover:text-text cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-1">
                          <label className="block text-[10px] text-subtext0 mb-1">Emoji</label>
                          <input
                            type="text"
                            maxLength={4}
                            value={repoBotEmoji}
                            onChange={(e) => setRepoBotEmoji(e.target.value)}
                            className="w-12 h-8 text-center text-[1rem] bg-surface0 border border-surface1 rounded text-text"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[10px] text-subtext0 mb-1">Bot Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Migration Linter"
                            value={repoBotName}
                            onChange={(e) => setRepoBotName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-subtext0 mb-1">Tagline</label>
                          <input
                            type="text"
                            placeholder="e.g. Database schema backwards compatibility"
                            value={repoBotTagline}
                            onChange={(e) => setRepoBotTagline(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-subtext0 mb-1">Category</label>
                          <select
                            value={repoBotCategory}
                            onChange={(e) => setRepoBotCategory(e.target.value as BotCategory)}
                            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text cursor-pointer"
                          >
                            {BOT_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-subtext0 mb-1">System Prompt *</label>
                        <textarea
                          rows={3}
                          required
                          value={repoBotPrompt}
                          onChange={(e) => setRepoBotPrompt(e.target.value)}
                          placeholder="Specialized instructions for this repository..."
                          className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 rounded text-xs font-mono text-text"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingRepoBot(false)}
                          className="px-3 py-1 bg-surface0 text-xs rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1 bg-accent text-on-accent font-semibold text-xs rounded cursor-pointer shadow-xs"
                        >
                          Save Bot
                        </button>
                      </div>
                    </form>
                  )}

                  {/* CARDS GRID */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* INHERITED MODE: Show all enabled global bots */}
                    {inheritAgents &&
                      globalReviewers
                        .filter((b) => b.enabled)
                        .map((bot) => (
                          <div
                            key={bot.id}
                            className="p-3 bg-crust border border-surface0 space-y-2 flex flex-col justify-between hover:border-surface1 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xl p-1 bg-surface0 rounded">{bot.avatarEmoji}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-text truncate">
                                      {bot.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand/10 text-brand border border-brand/20">
                                      Global
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-subtext0 font-mono truncate block">
                                    {bot.tagline}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">
                                {bot.description}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-surface0/60 flex items-center justify-between text-[11px]">
                              <span className="text-brand flex items-center gap-1 font-mono font-medium">
                                <Check className="w-3 h-3 text-brand" /> Active in MRs
                              </span>
                              <span className="text-subtext1 capitalize font-mono text-[10px]">
                                {bot.category}
                              </span>
                            </div>
                          </div>
                        ))}

                    {/* CUSTOM MODE: Show global + repo custom bots with checkbox toggles */}
                    {!inheritAgents &&
                      [...globalReviewers, ...repoExclusiveBots].map((bot) => {
                        const isChecked = activeBotSet.has(bot.id);
                        const isRepoExclusive = repoExclusiveBots.some((b) => b.id === bot.id);

                        return (
                          <div
                            key={bot.id}
                            onClick={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
                            className={`p-3 border space-y-2 flex flex-col justify-between cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-surface0/30 border-surface1 shadow-xs'
                                : 'bg-crust border-surface0/50 opacity-60'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
                                  className="rounded border-surface1 text-accent focus:ring-0 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xl p-1 bg-surface0 rounded">{bot.avatarEmoji}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-text truncate">
                                      {bot.name}
                                    </span>
                                    {isRepoExclusive ? (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                                        Repo Custom
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface1 text-subtext0">
                                        Global
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-subtext0 font-mono truncate block">
                                    {bot.tagline}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">
                                {bot.description}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-surface0/60 flex items-center justify-between text-[11px]">
                              <span
                                className={`flex items-center gap-1 font-mono text-[10px] ${
                                  isChecked ? 'text-accent font-medium' : 'text-subtext0'
                                }`}
                              >
                                {isChecked ? '✓ Enabled for repo' : 'Disabled for repo'}
                              </span>
                              {isRepoExclusive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRepoCustomReviewer(currentRepoId, bot.id);
                                  }}
                                  className="text-subtext0 hover:text-red-400 p-0.5 cursor-pointer"
                                  title="Delete repo-exclusive bot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* CUSTOM RULES FOR THIS REPOSITORY */}
                <div className="p-4 bg-crust border border-surface0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" />
                      <span className="font-semibold text-xs text-text">
                        Custom Repository Instructions &amp; Rules
                      </span>
                    </div>
                    <span className="text-[10px] text-subtext0 font-mono">
                      Appended to bot reviewer prompts for this repo
                    </span>
                  </div>

                  <p className="text-xs text-subtext0">
                    Add project-specific coding standards, architecture constraints, or framework conventions. These directives apply to all active reviewers when evaluating Virtual MRs in this repository.
                  </p>

                  {/* QUICK SNIPPETS PILLS */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] uppercase font-bold text-subtext0/70 mr-1">
                      Quick Snippets:
                    </span>
                    {RULE_SNIPPETS.map((snip) => (
                      <button
                        key={snip.label}
                        type="button"
                        onClick={() => handleAppendSnippet(snip.text)}
                        className="px-2 py-0.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-[11px] rounded transition-colors cursor-pointer border border-surface1"
                        title={snip.text}
                      >
                        + {snip.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={customRules}
                    onChange={(e) => setCustomRules(e.target.value)}
                    placeholder="e.g. This project requires strict TypeScript without 'any'; verify Prisma query transactions; all exported APIs must include JSDoc comments..."
                    className="w-full px-3 py-2 rounded bg-surface0 border border-surface1 text-text text-xs font-mono focus:outline-none focus:border-brand leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-surface0 flex items-center justify-end bg-base/60">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs transition-colors cursor-pointer border border-surface1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
