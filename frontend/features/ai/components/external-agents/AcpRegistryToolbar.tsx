import { Search } from '../../../../common/components/icons/Search';
import type { AcpRegistryToolbarProps } from './AcpRegistryToolbarProps';

export function AcpRegistryToolbar({
  query,
  setQuery,
  setFilter,
  filter,
}: AcpRegistryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
      <label className="flex min-w-56 flex-1 items-center gap-2 border border-surface1 bg-base px-2.5 py-1.5 text-subtext0">
        <Search className="h-3.5 w-3.5" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ACP Registry…"
          className="w-full bg-transparent text-xs text-text outline-none placeholder:text-subtext0 rounded-sm"
        />
      </label>
      <div className="flex border border-surface1 text-xs">
        {(
          [
            ['all', 'All'],
            ['installed', 'Installed'],
            ['not-installed', 'Not Installed'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`border-r border-surface1 px-3 py-1.5 last:border-r-0 rounded-sm ${filter === id ? 'bg-surface1 text-text' : 'text-subtext0 hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
