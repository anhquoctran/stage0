import React, { useState, useRef, useEffect } from 'react';
import { GitCommit } from '../../../common/components/icons/GitCommit';
import { Clock } from '../../../common/components/icons/Clock';
import { Copy } from '../../../common/components/icons/Copy';
import { Check } from '../../../common/components/icons/Check';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { History } from '../../../common/components/icons/History';
import { formatUnixDateTime, formatUnixRelativeTime } from '@/common/utils/dateTime';
import { buildRemoteCommitUrl } from '../utils/fileActions';
import type { InlineBlameProps } from '../types/InlineBlameProps';

export const InlineBlame: React.FC<InlineBlameProps> = ({
  commit,
  lineNo,
  currentUser,
  remoteUrl,
  onOpenFullBlame,
  showToast,
}) => {
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<number | null>(null);

  // Close card on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsCardOpen(false);
      }
    };
    if (isCardOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isCardOpen]);

  const handleMouseEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setIsCardOpen(true);
    }, 350);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const handleCopySha = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!commit?.commit_id) return;
    navigator.clipboard.writeText(commit.commit_id);
    setCopiedSha(true);
    showToast?.(`Copied commit SHA: ${commit.commit_id.substring(0, 7)}`);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleCopyMsg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!commit?.summary) return;
    navigator.clipboard.writeText(commit.summary);
    setCopiedMsg(true);
    showToast?.('Copied commit message');
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  if (!commit) return null;

  const isUncommitted =
    commit.commit_id.startsWith('0000000') ||
    commit.author.toLowerCase().includes('not committed') ||
    commit.author.toLowerCase() === 'you';

  const isYou =
    isUncommitted ||
    Boolean(
      (currentUser?.name &&
        commit.author.toLowerCase() === currentUser.name.toLowerCase()) ||
        (currentUser?.email &&
          commit.author_mail
            .toLowerCase()
            .includes(currentUser.email.toLowerCase()))
    );

  const authorName = isYou ? 'You' : commit.author;
  const relativeTime = isUncommitted
    ? 'Uncommitted changes'
    : formatUnixRelativeTime(commit.author_time);

  const shortSha = commit.commit_id.substring(0, 7);
  const truncatedSummary =
    commit.summary && commit.summary.length > 55
      ? `${commit.summary.substring(0, 52)}...`
      : commit.summary;

  const remoteCommitUrl = remoteUrl
    ? buildRemoteCommitUrl(remoteUrl, commit.commit_id)
    : null;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        setIsCardOpen(!isCardOpen);
      }}
      className="inline-blame-badge relative ml-8 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono text-subtext0/45 hover:text-subtext1 select-none cursor-pointer transition-colors duration-150 align-baseline group/blame"
      title="Click or hover to inspect commit details"
    >
      <GitCommit className="w-3 h-3 text-subtext0/35 group-hover/blame:text-subtext1 shrink-0 transition-colors" />

      {/* Author and time */}
      <span className="font-semibold text-subtext1/70 group-hover/blame:text-subtext1 transition-colors">
        {authorName}
      </span>
      <span className="text-subtext0/50">, {relativeTime}</span>

      {/* Bullet & Commit summary (if committed) */}
      {!isUncommitted && commit.summary && (
        <>
          <span className="text-subtext0/30">•</span>
          <span
            className="text-subtext0/55 group-hover/blame:text-subtext1/90 truncate max-w-[280px] xl:max-w-[420px] transition-colors"
            title={commit.summary}
          >
            {truncatedSummary}
          </span>
        </>
      )}

      {/* VSCode GitLens Style Rich Hover/Click Card */}
      {isCardOpen && (
        <div
          ref={cardRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 w-84 bg-mantle border border-surface1 shadow-2xl rounded-lg p-3 z-50 text-left text-xs font-sans text-text select-text animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header: Commit SHA & Web Link */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface0 text-[11px]">
            <div className="flex items-center gap-1.5 font-mono text-subtext1">
              <GitCommit className="w-3.5 h-3.5 text-subtext0 shrink-0" />
              <span className="font-bold text-text">
                {isUncommitted ? 'Working Tree' : shortSha}
              </span>
              {!isUncommitted && (
                <button
                  type="button"
                  onClick={handleCopySha}
                  className="p-1 hover:bg-surface0 rounded text-subtext0 hover:text-text transition-colors cursor-pointer"
                  title="Copy full commit SHA"
                >
                  {copiedSha ? (
                    <Check className="w-3 h-3 text-green" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {remoteCommitUrl && !isUncommitted && (
                <a
                  href={remoteCommitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface0 text-[10px] text-subtext0 hover:text-text transition-colors"
                  title="Open commit in web browser"
                >
                  <span>Remote</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              <span className="text-[10px] text-subtext0 font-mono">
                Line {lineNo}
              </span>
            </div>
          </div>

          {/* Author Details */}
          <div className="space-y-1 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-surface0 border border-surface1 flex items-center justify-center text-[10px] font-bold text-text shrink-0 uppercase">
                {commit.author ? commit.author.charAt(0) : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-text truncate">
                  {commit.author} {isYou && <span className="text-subtext0 font-normal">(You)</span>}
                </div>
                {commit.author_mail && (
                  <div className="text-[10px] text-subtext0 truncate font-mono">
                    {commit.author_mail}
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time */}
            {!isUncommitted && (
              <div className="flex items-center gap-1.5 text-[10px] text-subtext0 pt-1">
                <Clock className="w-3 h-3 text-subtext0 shrink-0" />
                <span>
                  {formatUnixRelativeTime(commit.author_time)} (
                  {formatUnixDateTime(commit.author_time, commit.author_tz)})
                </span>
              </div>
            )}
          </div>

          {/* Commit Message Box */}
          <div className="bg-surface0/60 border border-surface0 rounded p-2 text-xs font-mono text-text whitespace-pre-wrap break-words max-h-32 overflow-y-auto mb-2.5 select-text">
            {commit.summary || (isUncommitted ? 'Uncommitted changes in working copy' : 'No commit message')}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-surface0/80 text-[11px]">
            <button
              type="button"
              onClick={handleCopyMsg}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            >
              {copiedMsg ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
              <span>Copy Message</span>
            </button>

            {onOpenFullBlame && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCardOpen(false);
                  onOpenFullBlame();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-surface0 hover:bg-surface1 text-text transition-colors cursor-pointer font-medium"
                title="Open full file blame table"
              >
                <History className="w-3 h-3 text-subtext0" />
                <span>File Blame</span>
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
};
