import React, { useState } from 'react';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';
import { Edit2 } from '../../../../common/components/icons/Edit2';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { useGitStore } from '../../store/useGitStore';
import { useVirtualMrStore } from '../../../virtual-mr/store/useVirtualMrStore';

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
];

export const RepositoryLabelsTab: React.FC = () => {
  const { showToast } = useGitStore();
  const {
    repoLabels,
    createRepoLabel,
    updateRepoLabel,
    deleteRepoLabel,
    loadPresetLabels,
  } = useVirtualMrStore();

  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelFormName, setLabelFormName] = useState('');
  const [labelFormColor, setLabelFormColor] = useState('#3b82f6');
  const [labelFormDesc, setLabelFormDesc] = useState('');

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

  return (
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
            className="shrink-0 whitespace-nowrap px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer border border-surface1 rounded-sm"
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
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer border border-surface2/40 rounded-sm"
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
              className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
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
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-text text-xs focus:outline-none rounded-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-subtext0 mb-1">Description</label>
              <input
                type="text"
                placeholder="Describe the purpose of this label..."
                value={labelFormDesc}
                onChange={(e) => setLabelFormDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-text text-xs focus:outline-none rounded-sm"
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
                className="w-8 h-8 border-0 cursor-pointer bg-transparent rounded-sm"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLabelFormColor(c)}
                    className="w-6 h-6 border border-surface1 transition-transform hover:scale-110 cursor-pointer rounded-sm"
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
              className="px-3 py-1 bg-surface0 text-xs cursor-pointer rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs rounded-sm"
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
          <table className="w-full table-fixed text-start">
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
                <th scope="col" className="px-2 py-2 text-end font-medium">Actions</th>
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
                          className="h-2.5 w-2.5 shrink-0"
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
                          className="p-1.5 text-subtext0 hover:bg-surface1 hover:text-text cursor-pointer rounded-sm"
                          title={`Edit ${lbl.name}`}
                          aria-label={`Edit ${lbl.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRepoLabel(lbl.id)}
                          className="p-1.5 text-subtext0 hover:bg-red-500/20 hover:text-red-400 cursor-pointer rounded-sm"
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
  );
};

