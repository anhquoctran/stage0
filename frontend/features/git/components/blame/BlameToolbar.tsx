import { Check } from '../../../../common/components/icons/Check';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { Search } from '../../../../common/components/icons/Search';
import { Users } from '../../../../common/components/icons/Users';
import { X } from '../../../../common/components/icons/X';
import type { BlameToolbarProps } from './BlameToolbarProps';

export function BlameToolbar({
  revisionDropdownRef,
  setIsRevisionDropdownOpen,
  isRevisionDropdownOpen,
  blameRevision,
  compareBranch,
  setBlameRevision,
  baseBranch,
  branches,
  blameIgnoreWhitespace,
  setBlameIgnoreWhitespace,
  fetchFileBlame,
  isBlameLoading,
  searchQuery,
  setSearchQuery,
  blamePayload,
  statsDropdownRef,
  setIsStatsOpen,
  isStatsOpen,
}: BlameToolbarProps) {
  return (
    <div className="h-10 border-b border-surface0 bg-base px-3 flex items-center justify-between shrink-0 text-xs gap-3 rounded-sm">
      {/* Left: Revision Selector & Whitespace Toggle */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Revision Selector */}
        <div className="relative" ref={revisionDropdownRef}>
          <button
            type="button"
            onClick={() => setIsRevisionDropdownOpen(!isRevisionDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
            title="Select branch or revision to blame"
          >
            <GitBranch className="w-3.5 h-3.5 text-subtext0 shrink-0" />
            <span className="font-mono text-text font-medium truncate max-w-[150px]">
              {blameRevision || compareBranch || 'HEAD'}
            </span>
            <ChevronDown className="w-3 h-3 text-subtext0 shrink-0" />
          </button>

          {isRevisionDropdownOpen && (
            <div className="absolute start-0 top-full mt-1 w-64 shadow-2xl bg-mantle border border-surface0 py-1 z-50 rounded-sm text-xs animate-in fade-in duration-75">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/60 mb-1 rounded-sm">
                Blame Revision
              </div>

              {compareBranch && (
                <button
                  type="button"
                  onClick={() => {
                    setBlameRevision(compareBranch);
                    setIsRevisionDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-start transition-colors cursor-pointer rounded-sm ${
                    blameRevision === compareBranch
                      ? 'bg-surface0 text-text font-semibold'
                      : 'text-text'
                  }`}
                >
                  <span className="truncate">Compare: {compareBranch}</span>
                  {blameRevision === compareBranch && <Check className="w-3.5 h-3.5 text-text" />}
                </button>
              )}

              {baseBranch && (
                <button
                  type="button"
                  onClick={() => {
                    setBlameRevision(baseBranch);
                    setIsRevisionDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-start transition-colors cursor-pointer rounded-sm ${
                    blameRevision === baseBranch
                      ? 'bg-surface0 text-text font-semibold'
                      : 'text-text'
                  }`}
                >
                  <span className="truncate">Base: {baseBranch}</span>
                  {blameRevision === baseBranch && <Check className="w-3.5 h-3.5 text-text" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setBlameRevision('HEAD');
                  setIsRevisionDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-start transition-colors cursor-pointer rounded-sm ${
                  blameRevision === 'HEAD' ? 'bg-surface0 text-text font-semibold' : 'text-text'
                }`}
              >
                <span>HEAD (Working Commit)</span>
                {blameRevision === 'HEAD' && <Check className="w-3.5 h-3.5 text-text" />}
              </button>

              {branches?.local && branches.local.length > 0 && (
                <>
                  <div className="my-1 border-t border-surface0" />
                  <div className="px-3 py-0.5 text-[9px] font-bold uppercase tracking-wider text-subtext0">
                    Local Branches
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {branches.local.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setBlameRevision(b);
                          setIsRevisionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-start transition-colors cursor-pointer rounded-sm ${
                          blameRevision === b ? 'bg-surface0 text-text font-semibold' : 'text-text'
                        }`}
                      >
                        <span className="truncate">{b}</span>
                        {blameRevision === b && <Check className="w-3.5 h-3.5 text-text" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Ignore Whitespace Toggle (-w) */}
        <label
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
          title="Ignore whitespace changes when attributing lines (-w)"
        >
          <input
            type="checkbox"
            checked={blameIgnoreWhitespace}
            onChange={(e) => setBlameIgnoreWhitespace(e.target.checked)}
            className="accent-text cursor-pointer w-3.5 h-3.5"
          />
          <span className="text-[11px] text-subtext0 hover:text-text">Ignore Whitespace</span>
        </label>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={() => fetchFileBlame()}
          disabled={isBlameLoading}
          className="p-1.5 rounded-sm bg-mantle hover:bg-surface0 border border-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer disabled:opacity-40"
          title="Refresh Git Blame"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isBlameLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Right: Search Filter & Author Stats Pill */}
      <div className="flex items-center gap-2">
        {/* Search Filter */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute start-2 text-subtext0 pointer-events-none" />
          <input
            type="text"
            placeholder="Search blame (code, author, commit)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-7 pe-6 py-1 w-56 text-xs bg-mantle border border-surface0 rounded-sm text-text placeholder-subtext0 focus:outline-none focus:border-surface2 transition-colors font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-1.5 p-0.5 text-subtext0 hover:text-text rounded-sm cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Contributors Stats Pill */}
        {blamePayload && blamePayload.author_stats.length > 0 && (
          <div className="relative" ref={statsDropdownRef}>
            <button
              type="button"
              onClick={() => setIsStatsOpen(!isStatsOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
              title="View contributor breakdown"
            >
              <Users className="w-3.5 h-3.5 text-subtext0 shrink-0" />
              <span className="font-medium text-subtext1">
                {blamePayload.author_stats.length}{' '}
                {blamePayload.author_stats.length === 1 ? 'author' : 'authors'}
              </span>
              <span className="text-subtext0 font-mono">({blamePayload.total_lines} lines)</span>
              <ChevronDown className="w-3 h-3 text-subtext0 shrink-0" />
            </button>

            {isStatsOpen && (
              <div className="absolute end-0 top-full mt-1 w-72 shadow-2xl bg-mantle border border-surface0 py-2 px-3 z-50 rounded-sm text-xs animate-in fade-in duration-75">
                <div className="text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/60 pb-1 mb-2">
                  Line Attribution Breakdown
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                  {blamePayload.author_stats.map((st) => (
                    <div key={st.email || st.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className="font-semibold text-text truncate max-w-[170px]"
                          title={st.name}
                        >
                          {st.name}
                        </span>
                        <span className="text-[11px] font-mono text-subtext0">
                          {st.line_count} ({st.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface0 h-1.5 rounded-sm overflow-hidden">
                        <div
                          className="bg-subtext1 h-full rounded-sm transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(2, st.percentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
