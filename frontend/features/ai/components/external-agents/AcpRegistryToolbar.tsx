import { Search } from '../../../../common/components/icons/Search';
import { useTranslation } from 'react-i18next';
import type { AcpRegistryToolbarProps } from './AcpRegistryToolbarProps';

export function AcpRegistryToolbar({
  query,
  setQuery,
  setFilter,
  filter,
}: AcpRegistryToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
      <label className="flex min-w-56 flex-1 items-center gap-2 border border-surface1 bg-base px-2.5 py-1.5 text-subtext0 rounded-sm">
        <Search className="h-3.5 w-3.5" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('ai.externalAgents.searchRegistry')}
          className="w-full bg-transparent text-xs text-text outline-none placeholder:text-subtext0"
        />
      </label>
      <div className="flex items-center gap-1 border border-surface1 bg-crust p-0.5 rounded-sm text-xs">
        {(
          [
            ['all', t('ai.externalAgents.all')],
            ['installed', t('ai.externalAgents.installed')],
            ['not-installed', t('ai.externalAgents.notInstalled')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-3 py-1 rounded-sm transition-colors cursor-pointer font-medium ${
              filter === id
                ? 'bg-surface2 text-text shadow-xs'
                : 'text-subtext0 hover:bg-surface0 hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
