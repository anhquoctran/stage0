import { useTranslation } from 'react-i18next';
import encodings from '../../../../../shared/text-encodings.json';

export function FileEncodingPicker({ encoding, onChange }: {
  encoding: string | null;
  onChange: (encoding: string | null) => void;
}) {
  const { t } = useTranslation();
  return <label className="flex items-center text-xs text-subtext0">
      <span className="sr-only">{t('git.encoding.label')}</span>
      <select aria-label={t('git.encoding.label')} title={t('git.encoding.label')}
        value={encoding ?? ''} onChange={event => onChange(event.target.value || null)}
        className="max-w-44 min-w-0 rounded-sm border border-surface1 bg-base px-2 py-1 text-xs text-text focus-visible:outline-2 focus-visible:outline-brand">
        <option value="">{t('git.encoding.automatic')}</option>
        {encodings.map(encoding => <option key={encoding} value={encoding}>{encoding}</option>)}
      </select>
  </label>;
}
