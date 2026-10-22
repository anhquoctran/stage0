import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from '../../../common/components/icons/Info';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { useGitStore } from '../store/useGitStore';
import { type BlameCommit } from '../types/BlameCommit';
import { type BlameLine } from '../types/BlameLine';
import { buildRemoteCommitUrl } from '../utils/fileActions';
import { BlameCommitDetailModal } from './blame/BlameCommitDetailModal';
import { BlameLinesTable } from './blame/BlameLinesTable';
import { BlameToolbar } from './blame/BlameToolbar';

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
      if (revisionDropdownRef.current && !revisionDropdownRef.current.contains(e.target as Node)) {
        setIsRevisionDropdownOpen(false);
      }
      if (statsDropdownRef.current && !statsDropdownRef.current.contains(e.target as Node)) {
        setIsStatsOpen(false);
      }
      if (commitModalRef.current && !commitModalRef.current.contains(e.target as Node)) {
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
      <BlameToolbar
        revisionDropdownRef={revisionDropdownRef}
        setIsRevisionDropdownOpen={setIsRevisionDropdownOpen}
        isRevisionDropdownOpen={isRevisionDropdownOpen}
        blameRevision={blameRevision}
        compareBranch={compareBranch}
        setBlameRevision={setBlameRevision}
        baseBranch={baseBranch}
        branches={branches}
        blameIgnoreWhitespace={blameIgnoreWhitespace}
        setBlameIgnoreWhitespace={setBlameIgnoreWhitespace}
        fetchFileBlame={fetchFileBlame}
        isBlameLoading={isBlameLoading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        blamePayload={blamePayload}
        statsDropdownRef={statsDropdownRef}
        setIsStatsOpen={setIsStatsOpen}
        isStatsOpen={isStatsOpen}
        Math={Math}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-base p-2">
        {isBlameLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-subtext0 border-t-text  animate-spin" />
            <span className="font-medium text-text">Loading Git Blame...</span>
            <span className="text-[11px] text-subtext0">
              Running git blame for {selectedFile.path}
            </span>
          </div>
        ) : blameError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-mantle border border-surface0 ">
            <Info className="w-8 h-8 text-subtext0 mb-2" />
            <h4 className="text-sm font-bold text-text mb-1">Failed to Blame File</h4>
            <p className="text-xs text-subtext0 font-mono max-w-md mb-4 break-all">{blameError}</p>
            <button
              type="button"
              onClick={() => fetchFileBlame()}
              className="px-3.5 py-1.5  bg-surface1 hover:bg-surface2 text-text text-xs font-medium border border-surface2 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-subtext0 text-xs">
            {searchQuery
              ? 'No lines match your search query.'
              : 'Empty file or no blame lines available.'}
          </div>
        ) : (
          <BlameLinesTable
            fontFamily={fontFamily}
            fontSize={fontSize}
            lineSpacing={lineSpacing}
            filteredLines={filteredLines}
            setSelectedCommit={setSelectedCommit}
            enableLigatures={enableLigatures}
          />
        )}
      </div>

      {/* Commit Detail Modal / Popover */}
      {selectedCommit && (
        <BlameCommitDetailModal
          commitModalRef={commitModalRef}
          setSelectedCommit={setSelectedCommit}
          selectedCommit={selectedCommit}
          handleCopySha={handleCopySha}
          copiedSha={copiedSha}
          handleCopyCommitUrl={handleCopyCommitUrl}
        />
      )}
    </div>
  );
};
