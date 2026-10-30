import React from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CloneOptionsFormProps } from '../types/CloneOptionsFormProps';
import { validateCloneOptions } from '../utils/cloneOptions';
import { cloneRefOptions } from '../utils/cloneRefOptions';

export const CloneOptionsForm: React.FC<CloneOptionsFormProps> = ({ options, onChange, disabled, remoteRefs, refsLoading }) => {
  const { t } = useTranslation();
  const inputClass = 'w-full border border-surface1 bg-surface0 px-3 py-2 text-xs text-text outline-none focus:border-primary disabled:opacity-50';
  const validationError = validateCloneOptions(options);

  return (
    <section aria-labelledby="clone-options-title" className="border border-surface1 bg-base/40">
      <h3 id="clone-options-title" className="px-3 py-3 text-xs font-semibold text-text">{t('git.cloneOptions.title')}</h3>
      <fieldset disabled={disabled} className="space-y-4 border-t border-surface0 p-3 disabled:opacity-50">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-xs text-text">
            <label htmlFor="clone-remote-ref">{t('git.cloneOptions.branchTag')} ({t('common.optional')})</label>
            {remoteRefs ? <CustomSelect id="clone-remote-ref" value={options.branch} options={cloneRefOptions(remoteRefs)}
              onChange={(branch) => onChange({ ...options, branch })} disabled={disabled || refsLoading}
              searchable searchPlaceholder={t('git.cloneOptions.searchRefs')} aria-label={t('git.cloneOptions.branchTag')}
              className="w-full" buttonClassName="w-full py-2" dropdownWidth="w-full" align="left" />
              : <input id="clone-remote-ref" value={options.branch} onChange={(event) => onChange({...options,branch:event.target.value})}
                disabled={disabled || refsLoading} placeholder={refsLoading ? t('git.cloneOptions.loadingRefs') : t('git.cloneOptions.remoteDefaultBranch')} className={inputClass} />}
            {remoteRefs && <p className="text-[10px] text-subtext0">{t('git.cloneOptions.refsCount', { branches: remoteRefs.branches.length, tags: remoteRefs.tags.length })}</p>}
          </div>
          <label className="space-y-1.5 text-xs text-text">
            <span>{t('git.cloneOptions.shallowDepth')} ({t('common.optional')})</span>
            <input type="number" min={1} max={1_000_000} step={1} value={options.depth ?? ''} onChange={(event) => onChange({...options,depth:event.target.value === '' ? null : Number(event.target.value)})} placeholder={t('git.cloneOptions.completeHistory')} className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ['singleBranch', 'allBranches', true], ['noTags', 'includeTags', true],
            ['skipLfs', 'downloadLfs', true], ['blobless', 'partialClone', false], ['sparse', 'sparseCheckout', false],
          ] as const).map(([key,labelKey,inverted]) => (
            <label key={key} className="flex items-center gap-2 text-xs text-text cursor-pointer">
              <input type="checkbox" className="accent-brand" checked={inverted ? !options[key] : options[key]} onChange={(event) => onChange({ ...options, [key]:inverted ? !event.target.checked : event.target.checked, ...(key === 'blobless' && !event.target.checked ? {filterSubmodules:false} : {}) })} />
              {t(`git.cloneOptions.${labelKey}`)}
            </label>
          ))}
        </div>
        <div className="space-y-3 border-t border-surface0 pt-3">
          <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
            <input type="checkbox" className="accent-brand" checked={options.recurseSubmodules} onChange={(event) => onChange({...options,recurseSubmodules:event.target.checked,...(!event.target.checked ? {shallowSubmodules:false,filterSubmodules:false} : {})})} />
            {t('git.cloneOptions.recursiveSubmodules')}
          </label>
            <div className={`space-y-3 ps-5 ${!options.recurseSubmodules ? 'opacity-50' : ''}`}>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={options.shallowSubmodules} disabled={disabled || !options.recurseSubmodules} onChange={(event) => onChange({...options,shallowSubmodules:event.target.checked})} />
                {t('git.cloneOptions.shallowSubmodules')}
              </label>
              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={options.filterSubmodules} disabled={disabled || !options.recurseSubmodules || !options.blobless} onChange={(event) => onChange({...options,filterSubmodules:event.target.checked})} />
                {t('git.cloneOptions.filterSubmodules')}
              </label>
              <label className="block space-y-1.5 text-xs text-text">
                <span>{t('git.cloneOptions.parallelJobs')}</span>
                <input type="number" min={1} max={32} step={1} value={options.submoduleJobs} disabled={disabled || !options.recurseSubmodules} onChange={(event) => onChange({...options,submoduleJobs:Number(event.target.value)})} className={inputClass} />
              </label>
              <p className="text-[11px] leading-relaxed text-subtext0">{t('git.cloneOptions.submoduleHelp')}</p>
            </div>
        </div>
        <label className="block space-y-1.5 text-xs text-text">
          <span>{t('git.cloneOptions.timeout')}</span>
          <input type="number" min={1} max={1440} step={1} value={options.timeoutMinutes} onChange={(event) => onChange({...options,timeoutMinutes:Number(event.target.value)})} className={inputClass} />
        </label>
        {(options.depth !== null || options.singleBranch) && <p className="text-[11px] leading-relaxed text-yellow">{t('git.cloneOptions.limitedHistoryWarning')}</p>}
        {options.blobless && <p className="text-[11px] leading-relaxed text-subtext0">{t('git.cloneOptions.partialCloneHelp')}</p>}
        {options.sparse && <p className="text-[11px] leading-relaxed text-subtext0">{t('git.cloneOptions.sparseHelp')}</p>}
        {options.skipLfs && <p className="text-[11px] leading-relaxed text-subtext0">{t('git.cloneOptions.lfsHelp')}</p>}
        <p className="text-[11px] leading-relaxed text-subtext0">{t('git.cloneOptions.setupScriptsNote')}</p>
        {validationError && <p role="alert" className="text-xs text-red">{t(validationError)}</p>}
      </fieldset>
    </section>
  );
};
