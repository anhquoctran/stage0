import { Check } from '../../../../common/components/icons/Check';
import { Copy } from '../../../../common/components/icons/Copy';
import type { ConflictBlocksViewProps } from './ConflictBlocksViewProps';

export function ConflictBlocksView({
  regions,
  baseBranch,
  handleCopy,
  copiedKey,
  fontFamily,
  fontSize,
  lineSpacing,
  enableLigatures,
  compareBranch,
}: ConflictBlocksViewProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {regions.map((region, idx) => (
        <div
          key={`conflict-block-${region.start_line}-${region.end_line}`}
          className="border border-red/40 rounded-sm overflow-hidden shadow-md bg-mantle"
        >
          {/* Block Header Banner */}
          <div className="bg-red/15 border-b border-red/30 px-3.5 py-2 flex items-center justify-between gap-2 rounded-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-sm bg-red text-white text-[10px] font-bold uppercase tracking-wider">
                Conflict Block #{idx + 1}
              </span>
              <span className="text-xs font-mono text-text font-semibold">
                Lines {region.start_line} – {region.end_line}
              </span>
            </div>

            <span className="text-[11px] text-subtext1">
              Conflicting changes on target branch vs source branch
            </span>
          </div>

          {/* 2-Column Side-by-Side Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface0">
            {/* Left Column: Target Branch (Base) */}
            <div className="flex flex-col min-w-0 bg-red/5">
              <div className="bg-surface0/90 border-b border-surface0 px-3 py-1.5 flex items-center justify-between rounded-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm bg-red shrink-0" />
                  <span className="text-xs font-bold text-red uppercase tracking-wider">
                    Current / Target
                  </span>
                  <code className="text-[11px] font-mono text-text bg-surface1 px-1.5 py-0.5 rounded-sm truncate max-w-[200px]">
                    {baseBranch}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(region.base_code, `base-${idx}`)}
                  className="p-1 rounded-sm text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                  title="Copy target branch code"
                >
                  {copiedKey === `base-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <pre
                style={{
                  fontFamily: fontFamily || 'inherit',
                  fontSize: fontSize ? `${fontSize}px` : '13px',
                  lineHeight: lineSpacing || 1.5,
                  fontVariantLigatures: enableLigatures ? 'normal' : 'none',
                }}
                className="p-3 text-xs overflow-x-auto font-mono text-text whitespace-pre flex-1"
              >
                {region.base_code || (
                  <em className="text-subtext0 italic">(Empty on {baseBranch})</em>
                )}
              </pre>
            </div>

            {/* Right Column: Source Branch (Compare) */}
            <div className="flex flex-col min-w-0 bg-blue/5">
              <div className="bg-surface0/90 border-b border-surface0 px-3 py-1.5 flex items-center justify-between rounded-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm bg-blue shrink-0" />
                  <span className="text-xs font-bold text-blue uppercase tracking-wider">
                    Incoming / Source
                  </span>
                  <code className="text-[11px] font-mono text-text bg-surface1 px-1.5 py-0.5 rounded-sm truncate max-w-[200px]">
                    {compareBranch}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(region.compare_code, `compare-${idx}`)}
                  className="p-1 rounded-sm text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                  title="Copy incoming branch code"
                >
                  {copiedKey === `compare-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <pre
                style={{
                  fontFamily: fontFamily || 'inherit',
                  fontSize: fontSize ? `${fontSize}px` : '13px',
                  lineHeight: lineSpacing || 1.5,
                  fontVariantLigatures: enableLigatures ? 'normal' : 'none',
                }}
                className="p-3 text-xs overflow-x-auto font-mono text-text whitespace-pre flex-1"
              >
                {region.compare_code || (
                  <em className="text-subtext0 italic">(Empty on {compareBranch})</em>
                )}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
