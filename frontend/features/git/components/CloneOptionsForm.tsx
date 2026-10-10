import React from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CloneOptionsFormProps } from '../types/CloneOptionsFormProps';
import { validateCloneOptions } from '../utils/cloneOptions';
import { cloneRefOptions } from '../utils/cloneRefOptions';

export const CloneOptionsForm: React.FC<CloneOptionsFormProps> = ({ options, onChange, disabled, remoteRefs, refsLoading }) => {
  const inputClass = 'w-full border border-surface1 bg-surface0 px-3 py-2 text-xs text-text outline-none focus:border-primary disabled:opacity-50';
  const validationError = validateCloneOptions(options);

  return (
    <section aria-labelledby="clone-options-title" className="border border-surface1 bg-base/40">
      <h3 id="clone-options-title" className="px-3 py-3 text-xs font-semibold text-text">Clone options</h3>
      <fieldset disabled={disabled} className="space-y-4 border-t border-surface0 p-3 disabled:opacity-50">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-xs text-text">
            <label htmlFor="clone-remote-ref">Branch / tag (optional)</label>
            {remoteRefs ? <CustomSelect id="clone-remote-ref" value={options.branch} options={cloneRefOptions(remoteRefs)}
              onChange={(branch) => onChange({ ...options, branch })} disabled={disabled || refsLoading}
              searchable searchPlaceholder="Search branches and tags..." aria-label="Branch / tag (optional)"
              className="w-full" buttonClassName="w-full py-2" dropdownWidth="w-full" align="left" />
              : <input id="clone-remote-ref" value={options.branch} onChange={(event) => onChange({...options,branch:event.target.value})}
                disabled={disabled || refsLoading} placeholder={refsLoading ? 'Loading branches and tags...' : 'Remote default branch'} className={inputClass} />}
            {remoteRefs && <p className="text-[10px] text-subtext0">{remoteRefs.branches.length} branches · {remoteRefs.tags.length} tags</p>}
          </div>
          <label className="space-y-1.5 text-xs text-text">
            <span>Shallow clone depth (optional)</span>
            <input type="number" min={1} max={1_000_000} step={1} value={options.depth ?? ''} onChange={(event) => onChange({...options,depth:event.target.value === '' ? null : Number(event.target.value)})} placeholder="Empty = complete history" className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ['singleBranch', 'Clone all branches', true], ['noTags', 'Include tags', true],
            ['skipLfs', 'Download Git LFS files', true],
            ['blobless', 'Partial clone (blob:none)', false], ['sparse', 'Sparse checkout (top-level files only)', false],
          ] as const).map(([key,label,inverted]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-text cursor-pointer">
              <input type="checkbox" className="accent-brand" checked={inverted ? !options[key] : options[key]} onChange={(event) => onChange({ ...options, [key]:inverted ? !event.target.checked : event.target.checked, ...(key === 'blobless' && !event.target.checked ? {filterSubmodules:false} : {}) })} />
              {label}
            </label>
          ))}
        </div>
        <div className="space-y-3 border-t border-surface0 pt-3">
          <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
            <input type="checkbox" className="accent-brand" checked={options.recurseSubmodules} onChange={(event) => onChange({...options,recurseSubmodules:event.target.checked,...(!event.target.checked ? {shallowSubmodules:false,filterSubmodules:false} : {})})} />
            Clone submodules recursively (including nested submodules)
          </label>
            <div className={`space-y-3 pl-5 ${!options.recurseSubmodules ? 'opacity-50' : ''}`}>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={options.shallowSubmodules} disabled={disabled || !options.recurseSubmodules} onChange={(event) => onChange({...options,shallowSubmodules:event.target.checked})} />
                Shallow submodules (depth 1)
              </label>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={options.filterSubmodules} disabled={disabled || !options.recurseSubmodules || !options.blobless} onChange={(event) => onChange({...options,filterSubmodules:event.target.checked})} />
                Apply partial clone to submodules (Git 2.36+)
              </label>
              <label className="block space-y-1.5 text-xs text-text">
                <span>Parallel submodule jobs (1–32)</span>
                <input type="number" min={1} max={32} step={1} value={options.submoduleJobs} disabled={disabled || !options.recurseSubmodules} onChange={(event) => onChange({...options,submoduleJobs:Number(event.target.value)})} className={inputClass} />
              </label>
              <p className="text-[11px] leading-relaxed text-subtext0">Uses the commits recorded by the parent repo, not the latest remote branches. Submodules on other hosts need their own Git/SSH authentication.</p>
            </div>
        </div>
        <label className="block space-y-1.5 text-xs text-text">
          <span>Timeout (minutes, 1–1,440)</span>
          <input type="number" min={1} max={1440} step={1} value={options.timeoutMinutes} onChange={(event) => onChange({...options,timeoutMinutes:Number(event.target.value)})} className={inputClass} />
        </label>
        {(options.depth !== null || options.singleBranch) && <p className="text-[11px] leading-relaxed text-yellow">Limited history or branches can prevent Virtual MR comparisons from finding a common ancestor. Fetch more history / branches before reviewing.</p>}
        {options.blobless && <p className="text-[11px] leading-relaxed text-subtext0">Partial clone requires server support. Git downloads missing file contents on demand, including when opening diffs; offline review may be limited. Later downloads use your existing Git/SSH credentials, not the one-time clone credential.</p>}
        {options.sparse && <p className="text-[11px] leading-relaxed text-subtext0">Only top-level files are checked out initially. Expand folders later with git sparse-checkout set &lt;folders&gt;.</p>}
        {options.skipLfs && <p className="text-[11px] leading-relaxed text-subtext0">LFS files remain pointers for this clone. Download them later with git lfs pull.</p>}
        <p className="text-[11px] leading-relaxed text-subtext0">Cloning does not install package dependencies or run project setup scripts.</p>
        {validationError && <p role="alert" className="text-xs text-red">{validationError}</p>}
      </fieldset>
    </section>
  );
};
