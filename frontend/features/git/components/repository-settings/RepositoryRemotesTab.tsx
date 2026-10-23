import React, { useState } from 'react';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { Edit2 } from '../../../../common/components/icons/Edit2';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { Check } from '../../../../common/components/icons/Check';
import { AlertCircle } from '../../../../common/components/icons/AlertCircle';
import { useVirtualMrStore } from '../../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../../store/useGitStore';

export const RepositoryRemotesTab: React.FC = () => {
  const { showToast } = useGitStore();
  const {
    remotesDetailed,
    addRemote,
    removeRemote,
    setRemoteUrl,
    testRemote,
  } = useVirtualMrStore();

  const [testingRemoteName, setTestingRemoteName] = useState<string | null>(null);
  const [remoteTestResult, setRemoteTestResult] = useState<{
    [name: string]: { success: boolean; message: string };
  }>({});

  const [isAddingRemote, setIsAddingRemote] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [newRemoteUrl, setNewRemoteUrl] = useState('');

  const [editingRemoteName, setEditingRemoteName] = useState<string | null>(null);
  const [editingRemoteUrl, setEditingRemoteUrl] = useState('');

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

  return (
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
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer border border-surface2/40 rounded-sm"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Add Remote</span>
        </button>
      </div>

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
              className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
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
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-text text-xs focus:outline-none focus:border-accent rounded-sm"
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
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-text text-xs focus:outline-none focus:border-accent rounded-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingRemote(false)}
              className="px-3 py-1 bg-surface0 hover:bg-surface1 text-xs cursor-pointer rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs rounded-sm"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {remotesDetailed.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-surface0 text-subtext0 text-xs rounded-sm">
            No remotes configured for this repository yet.
          </div>
        ) : (
          remotesDetailed.map((rem) => (
            <div
              key={rem.name}
              className="p-4 bg-crust border border-surface0 space-y-2.5 rounded-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{rem.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-surface0 font-mono text-subtext0">
                    {rem.name === 'origin' ? 'Default Origin' : 'Secondary'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestRemote(rem.name, rem.fetch_url)}
                    disabled={testingRemoteName === rem.name}
                    className="px-2.5 py-1 bg-surface0 hover:bg-surface1 text-xs font-mono text-subtext0 hover:text-text transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 rounded-sm"
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
                    className="p-1 hover:bg-surface1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
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
                    className="p-1 hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer rounded-sm"
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
                    className="flex-1 px-3 py-1 bg-surface0 border border-surface1 text-xs font-mono text-text focus:outline-none rounded-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRemoteUrl(rem.name)}
                    className="px-3 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs rounded-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRemoteName(null)}
                    className="px-2 py-1 bg-surface0 text-xs cursor-pointer rounded-sm"
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
                  className={`p-2 text-[11px] font-mono flex items-center gap-2 rounded-sm ${
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
  );
};

