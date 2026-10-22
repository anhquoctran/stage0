import { Check } from '../../../../common/components/icons/Check';
import { Copy } from '../../../../common/components/icons/Copy';
import type { GitBinaryListTableProps } from './GitBinaryListTableProps';

export function GitBinaryListTable({
  allBinaries,
  draftBinaryId,
  draftBinaryPath,
  committedBinaryId,
  committedBinaryPath,
  onSelectBinary,
  getSourceIcon,
  getSourceBadge,
  handleCopyPath,
  copiedPath,
}: GitBinaryListTableProps) {
  return (
    <div className="border border-surface1 overflow-hidden">
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-mantle text-[10px] uppercase tracking-wider text-subtext0">
            <tr className="border-b border-surface1">
              <th scope="col" className="w-10 px-3 py-2" aria-label="Select" />
              <th scope="col" className="px-3 py-2 font-semibold">
                Git Binary
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Version
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Path
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Source
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Status
              </th>
              <th scope="col" className="w-10 px-3 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface0/70">
            {allBinaries.map((binary) => {
              const isSelected = binary.id === draftBinaryId || binary.path === draftBinaryPath;
              const isCurrentlyActive =
                binary.id === committedBinaryId || binary.path === committedBinaryPath;

              return (
                <tr
                  key={binary.id}
                  onClick={() => onSelectBinary(binary.id, binary.path)}
                  className={`group cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand/10' : 'bg-surface0/20 hover:bg-surface0/70'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="radio"
                      name="active-git-binary"
                      checked={isSelected}
                      onChange={() => onSelectBinary(binary.id, binary.path)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${binary.name}`}
                      className="h-4 w-4 accent-violet-500 cursor-pointer"
                    />
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{getSourceIcon(binary.source)}</span>
                      <span
                        className={`truncate ${isSelected ? 'font-bold text-text' : 'font-semibold text-text'}`}
                      >
                        {binary.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px] text-subtext1 whitespace-nowrap">
                      {binary.version || 'Version unknown'}
                    </span>
                  </td>
                  <td className="max-w-[420px] px-3 py-2.5">
                    <span
                      className="block truncate font-mono text-[11px] text-subtext0"
                      title={binary.path}
                    >
                      {binary.path}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{getSourceBadge(binary.source)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {isCurrentlyActive ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green/15 text-green border border-green/30">
                        Active
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-peach/15 text-peach border border-peach/30">
                        Selected
                      </span>
                    ) : (
                      <span className="text-subtext0">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(event) => handleCopyPath(binary.path, event)}
                      className="p-1.5 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Copy binary path to clipboard"
                    >
                      {copiedPath === binary.path ? (
                        <Check className="w-3.5 h-3.5 text-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
