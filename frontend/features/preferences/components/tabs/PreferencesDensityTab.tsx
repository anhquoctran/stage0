import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { UiDensity } from '../../types/UiDensity';
import { UI_DENSITIES } from '../../utils/uiDensity';

export function PreferencesDensityTab({ value, onChange }: {
  value: UiDensity;
  onChange: (value: UiDensity) => void;
}) {
  const { t } = useTranslation();
  const groupId = useId();
  return <div className="space-y-4">
    <p className="text-xs text-subtext0">{t('preferences.density.description')}</p>
    <div role="radiogroup" aria-label={t('preferences.density.title')} className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {UI_DENSITIES.map(density => <label key={density}
        className={`density-choice min-w-0 relative cursor-pointer rounded-sm p-4 transition-colors ${value === density ? 'bg-brand text-on-accent border-0' : 'bg-base text-text border border-surface1 hover:border-brand'}`}>
        <input type="radio" name={`${groupId}-density`} value={density} checked={value === density}
          onChange={() => onChange(density)} aria-labelledby={`${groupId}-${density}`} className="sr-only" />
        <div className="flex items-center justify-between gap-2 mb-3">
          <span id={`${groupId}-${density}`} className="text-sm font-semibold">{t(`preferences.density.${density}`)}</span>
          {density === 'standard' && <span className="text-[10px] rounded-sm px-1.5 py-0.5 bg-black/15 text-inherit">{t('preferences.density.default')}</span>}
        </div>
        <div aria-hidden="true" className="density-preview rounded-sm bg-black/10 p-2 mb-3" data-density-preview={density}>
          {[0, 1, 2].map(row => <div key={row} className="density-preview-row flex items-center gap-2 border-b border-current/15 last:border-0">
            <span className="h-2 w-2 rounded-sm bg-current opacity-60 shrink-0" />
            <span className="h-1.5 w-3/5 rounded-sm bg-current opacity-30" />
          </div>)}
        </div>
        <p className="text-xs leading-relaxed opacity-80">{t(`preferences.density.${density}Description`)}</p>
      </label>)}
    </div>
    <p className="text-[11px] text-subtext0">{t('preferences.density.applyHint')}</p>
  </div>;
}
