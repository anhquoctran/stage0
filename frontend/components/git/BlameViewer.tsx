import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  GitCommit,
  User,
  Clock,
  Copy,
  Check,
  Search,
  X,
  ExternalLink,
  RotateCw,
  GitBranch,
  ChevronDown,
  Info,
  Users,
} from 'lucide-react';
import { BlameCommit, BlameLine } from '../../types/git';
import { useGitStore } from '../../store/useGitStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { buildRemoteCommitUrl } from '../../utils/fileActions';

function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - epochSeconds);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 365 * 86400) return `${Math.floor(diff / (30 * 86400))}mo ago`;
  return `${Math.floor(diff / (365 * 86400))}y ago`;
}

function formatExactDate(epochSeconds: number, tz?: string): string {
  if (!epochSeconds) return '';
  const d = new Date(epochSeconds * 1000);
  const formatted = d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return tz ? `${formatted} (${tz})` : formatted;
}

export const BlameViewer: React.FC = () => {
  const {
    selectedFile,
    blamePayload,
    isBlameLoading,
    blameError,
    blameRevision,
    blameIgnoreWhitespace,
    setBlameRevision,
    setBlameIgnoreWhitespace,
    fetchFileBlame,
    baseBranch,
    compareBranch,
    branches,
    remoteUrl,
    currentRepo,
    showToast,
  } = useGitStore();

  const { fontFamily, fontSize, lineSpacing, enableLigatures } = usePreferencesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<BlameCommit | null>(null);
  const [isRevisionDropdownOpen, setIsRevisionDropdownOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const revisionDropdownRef = useRef<HTMLDivElement>(null);
  const statsDropdownRef = useRef<HTMLDivElement>(null);
  const commitModalRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        revisionDropdownRef.current &&
        !revisionDropdownRef.current.contains(e.target as Node)
      ) {
        setIsRevisionDropdownOpen(false);
      }
      if (
        statsDropdownRef.current &&
        !statsDropdownRef.current.contains(e.target as Node)
      ) {
        setIsStatsOpen(false);
      }
      if (
        commitModalRef.current &&
        !commitModalRef.current.contains(e.target as Node)
      ) {
        setSelectedCommit(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRevisionDropdownOpen(false);
        setIsStatsOpen(false);
        setSelectedCommit(null);
      }
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Fetch blame when selected file changes or on initial mount
  useEffect(() => {
    if (selectedFile) {
      fetchFileBlame(selectedFile.path);
    }
  }, [selectedFile, fetchFileBlame]);

  const commitsMap = useMemo(() => {
    return blamePayload?.commits || {};
  }, [blamePayload]);

  // Compute block groupings: consecutive lines with same commit
  const linesWithMeta = useMemo(() => {
    if (!blamePayload) return [];
    let prevCommitId = '';

    return blamePayload.lines.map((line: BlameLine, idx: number) => {
      const isNewBlock = line.commit_id !== prevCommitId;
      prevCommitId = line.commit_id;
      const commit = commitsMap[line.commit_id];

      return {
        ...line,
        isNewBlock,
        commit,
        originalIndex: idx,
      };
    });
  }, [blamePayload, commitsMap]);

  // Filtered lines based on search query
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return linesWithMeta;
    const q = searchQuery.toLowerCase();

    return linesWithMeta.filter((l) => {
      const matchContent = l.content.toLowerCase().includes(q);
      const matchAuthor = l.commit?.author.toLowerCase().includes(q);
      const matchSummary = l.commit?.summary.toLowerCase().includes(q);
      const matchSha = l.commit_id.toLowerCase().includes(q);
      return matchContent || matchAuthor || matchSummary || matchSha;
    });
  }, [linesWithMeta, searchQuery]);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    showToast(`Copied commit SHA: ${sha.substring(0, 10)}...`);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleCopyCommitUrl = (sha: string) => {
    const effectiveRemote =
      remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
    if (!effectiveRemote) {
      showToast('No remote URL configured for this repository');
      return;
    }
    const url = buildRemoteCommitUrl(effectiveRemote, sha);
    navigator.clipboard.writeText(url);
    showToast('Copied remote commit link to clipboard');
  };

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base text-subtext0 text-xs">
        <Info className="w-8 h-8 text-subtext0 mb-2" />
        <p className="font-semibold text-text">No File Selected</p>
        <span className="text-[11px] text-subtext0 mt-0.5">
          Select a file from the sidebar to inspect its git blame.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-base overflow-hidden select-none">
      {/* Blame Sub-Toolbar */}
      <div className="h-10 border-b border-surface0 bg-base px-3 flex items-center justify-between shrink-0 text-xs gap-3">
        {/* Left: Revision Selector & Whitespace Toggle */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Revision Selector */}
          <div className="relative" ref={revisionDropdownRef}>
            <button
              type="button"
              onClick={() => setIsRevisionDropdownOpen(!isRevisionDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
              title="Select branch or revision to blame"
            >
              <GitBranch className="w-3.5 h-3.5 text-subtext0 shrink-0" />
              <span className="font-mono text-text font-medium truncate max-w-[150px]">
                {blameRevision || compareBranch || 'HEAD'}
              </span>
              <ChevronDown className="w-3 h-3 text-subtext0 shrink-0" />
            </button>

            {isRevisionDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-64 shadow-2xl bg-mantle border border-surface0 py-1 z-50 rounded-md text-xs animate-in fade-in duration-75">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/60 mb-1">
                  Blame Revision
                </div>

                {compareBranch && (
                  <button
                    type="button"
                    onClick={() => {
                      setBlameRevision(compareBranch);
                      setIsRevisionDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-left transition-colors cursor-pointer ${
                      blameRevision === compareBranch ? 'bg-surface0 text-text font-semibold' : 'text-text'
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
                    className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-left transition-colors cursor-pointer ${
                      blameRevision === baseBranch ? 'bg-surface0 text-text font-semibold' : 'text-text'
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-left transition-colors cursor-pointer ${
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
                          className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-left transition-colors cursor-pointer ${
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
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
            className="p-1.5 rounded bg-mantle hover:bg-surface0 border border-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer disabled:opacity-40"
            title="Refresh Git Blame"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isBlameLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Right: Search Filter & Author Stats Pill */}
        <div className="flex items-center gap-2">
          {/* Search Filter */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2 text-subtext0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search blame (code, author, commit)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-6 py-1 w-56 text-xs bg-mantle border border-surface0 rounded text-text placeholder-subtext0 focus:outline-none focus:border-surface2 transition-colors font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 p-0.5 text-subtext0 hover:text-text rounded cursor-pointer"
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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-mantle hover:bg-surface0 border border-surface0 text-xs text-text transition-colors cursor-pointer"
                title="View contributor breakdown"
              >
                <Users className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                <span className="font-medium text-subtext1">
                  {blamePayload.author_stats.length} {blamePayload.author_stats.length === 1 ? 'author' : 'authors'}
                </span>
                <span className="text-subtext0 font-mono">({blamePayload.total_lines} lines)</span>
                <ChevronDown className="w-3 h-3 text-subtext0 shrink-0" />
              </button>

              {isStatsOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 shadow-2xl bg-mantle border border-surface0 py-2 px-3 z-50 rounded-md text-xs animate-in fade-in duration-75">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/60 pb-1 mb-2">
                    Line Attribution Breakdown
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {blamePayload.author_stats.map((st) => (
                      <div key={st.email || st.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-text truncate max-w-[170px]" title={st.name}>
                            {st.name}
                          </span>
                          <span className="text-[11px] font-mono text-subtext0">
                            {st.line_count} ({st.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-surface0 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-subtext1 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, st.percentage))}%` }}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-base p-2">
        {isBlameLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-subtext0 border-t-text rounded-full animate-spin" />
            <span className="font-medium text-text">Loading Git Blame...</span>
            <span className="text-[11px] text-subtext0">
              Running git blame for {selectedFile.path}
            </span>
          </div>
        ) : blameError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-mantle border border-surface0 rounded-lg">
            <Info className="w-8 h-8 text-subtext0 mb-2" />
            <h4 className="text-sm font-bold text-text mb-1">Failed to Blame File</h4>
            <p className="text-xs text-subtext0 font-mono max-w-md mb-4 break-all">
              {blameError}
            </p>
            <button
              type="button"
              onClick={() => fetchFileBlame()}
              className="px-3.5 py-1.5 rounded bg-surface1 hover:bg-surface2 text-text text-xs font-medium border border-surface2 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-subtext0 text-xs">
            {searchQuery ? 'No lines match your search query.' : 'Empty file or no blame lines available.'}
          </div>
        ) : (
          <div className="border border-surface0 rounded-lg overflow-hidden bg-base shadow-xs text-xs font-mono">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface0 bg-mantle text-[10px] text-subtext0 uppercase font-sans font-bold select-none">
                  <th className="py-1.5 px-3 text-left w-20">Commit</th>
                  <th className="py-1.5 px-2 text-left w-36">Author</th>
                  <th className="py-1.5 px-2 text-left w-24">Date</th>
                  <th className="py-1.5 px-2 text-right w-12 border-r border-surface0">Line</th>
                  <th className="py-1.5 px-3 text-left">Content</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily, fontSize: `${fontSize}px`, lineHeight: lineSpacing }}>
                {filteredLines.map((row) => {
                  const isNewBlock = row.isNewBlock;
                  const commit = row.commit;
                  const shortSha = row.commit_id ? row.commit_id.substring(0, 7) : '0000000';

                  return (
                    <tr
                      key={row.line_no}
                      className={`group transition-colors hover:bg-surface0/60 ${
                        isNewBlock ? 'border-t border-surface0/70' : ''
                      }`}
                    >
                      {/* Commit SHA Badge */}
                      <td className="py-0.5 px-3 align-top whitespace-nowrap select-none">
                        {isNewBlock ? (
                          <button
                            type="button"
                            onClick={() => commit && setSelectedCommit(commit)}
                            className="font-mono text-[11px] text-subtext1 hover:text-text hover:underline cursor-pointer flex items-center gap-1"
                            title={`Click to inspect commit ${shortSha}: ${commit?.summary || ''}`}
                          >
                            <GitCommit className="w-3 h-3 text-subtext0 shrink-0" />
                            <span>{shortSha}</span>
                          </button>
                        ) : (
                          <span className="opacity-0 select-none text-[10px]">•</span>
                        )}
                      </td>

                      {/* Author */}
                      <td className="py-0.5 px-2 align-top truncate max-w-[140px] text-subtext1 group-hover:text-text select-none">
                        {isNewBlock && commit ? (
                          <span title={`${commit.author} <${commit.author_mail}>`}>
                            {commit.author}
                          </span>
                        ) : null}
                      </td>

                      {/* Date (Relative) */}
                      <td className="py-0.5 px-2 align-top whitespace-nowrap text-subtext0 select-none text-[11px]">
                        {isNewBlock && commit ? (
                          <span title={formatExactDate(commit.author_time, commit.author_tz)}>
                            {formatRelativeTime(commit.author_time)}
                          </span>
                        ) : null}
                      </td>

                      {/* Line Number */}
                      <td className="py-0.5 px-2 align-top text-right text-subtext0 border-r border-surface0 select-none text-[11px]">
                        {row.line_no}
                      </td>

                      {/* Code Content */}
                      <td
                        className={`py-0.5 px-3 align-top text-text whitespace-pre overflow-x-auto ${
                          enableLigatures ? 'font-variant-ligatures-normal' : ''
                        }`}
                      >
                        {row.content || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commit Detail Modal / Popover */}
      {selectedCommit && (
        <div className="fixed inset-0 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={commitModalRef}
            className="bg-mantle border border-surface0 rounded-lg w-full max-w-lg shadow-2xl p-4 animate-in zoom-in-95 duration-100 flex flex-col space-y-3.5 select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-surface0">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-subtext0" />
                <h4 className="text-sm font-bold text-text">Commit Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCommit(null)}
                className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Commit Message */}
            <div className="bg-base border border-surface0 rounded p-3">
              <div className="text-[10px] uppercase font-bold text-subtext0 mb-1">Commit Message</div>
              <p className="text-xs text-text font-medium whitespace-pre-wrap leading-relaxed">
                {selectedCommit.summary}
              </p>
            </div>

            {/* Commit Metadata Grid */}
            <div className="space-y-2 text-xs">
              {/* Full SHA */}
              <div className="flex items-center justify-between gap-2 p-2 bg-surface0/40 rounded border border-surface0/60 font-mono">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-[10px] uppercase block font-sans text-subtext0 font-bold">SHA</span>
                  <span className="text-xs text-text select-all font-semibold truncate block">
                    {selectedCommit.commit_id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopySha(selectedCommit.commit_id)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-text text-xs rounded transition-colors shrink-0 cursor-pointer"
                  title="Copy full SHA"
                >
                  {copiedSha ? <Check className="w-3.5 h-3.5 text-text" /> : <Copy className="w-3.5 h-3.5 text-subtext0" />}
                  <span>{copiedSha ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Author Info */}
              <div className="flex items-start gap-2 p-2 bg-surface0/20 rounded border border-surface0/40">
                <User className="w-4 h-4 text-subtext0 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-text">{selectedCommit.author}</div>
                  <div className="text-[11px] text-subtext0 font-mono">
                    {selectedCommit.author_mail ? `<${selectedCommit.author_mail}>` : '(no email)'}
                  </div>
                </div>
              </div>

              {/* Date Info */}
              <div className="flex items-start gap-2 p-2 bg-surface0/20 rounded border border-surface0/40">
                <Clock className="w-4 h-4 text-subtext0 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-text">
                    {formatExactDate(selectedCommit.author_time, selectedCommit.author_tz)}
                  </div>
                  <div className="text-[11px] text-subtext0">
                    {formatRelativeTime(selectedCommit.author_time)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-surface0">
              <button
                type="button"
                onClick={() => handleCopyCommitUrl(selectedCommit.commit_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs rounded transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-subtext0" />
                <span>Copy Remote Link</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCommit(null)}
                className="px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
