import { formatUnixDateTime, formatUnixRelativeTime } from '@/common/utils/dateTime';
import { Check } from '../../../../common/components/icons/Check';
import { Clock } from '../../../../common/components/icons/Clock';
import { Copy } from '../../../../common/components/icons/Copy';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { User } from '../../../../common/components/icons/User';
import { X } from '../../../../common/components/icons/X';
import type { BlameCommitDetailModalProps } from './BlameCommitDetailModalProps';

export function BlameCommitDetailModal({
  commitModalRef,
  setSelectedCommit,
  selectedCommit,
  handleCopySha,
  copiedSha,
  handleCopyCommitUrl,
}: BlameCommitDetailModalProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={commitModalRef}
        className="bg-mantle border border-surface0  w-full max-w-lg shadow-2xl p-4 animate-in zoom-in-95 duration-100 flex flex-col space-y-3.5 select-none"
      >
        {/* Header */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between pb-2.5 border-b border-surface0 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <GitCommit className="w-4 h-4 text-subtext0" />
            <h4 className="text-sm font-bold text-text">Commit Details</h4>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCommit(null)}
            className="p-1  text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Commit Message */}
        <div className="bg-base border border-surface0  p-3">
          <div className="text-[10px] uppercase font-bold text-subtext0 mb-1">Commit Message</div>
          <p className="text-xs text-text font-medium whitespace-pre-wrap leading-relaxed">
            {selectedCommit.summary}
          </p>
        </div>

        {/* Commit Metadata Grid */}
        <div className="space-y-2 text-xs">
          {/* Full SHA */}
          <div className="flex items-center justify-between gap-2 p-2 bg-surface0/40  border border-surface0/60 font-mono">
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[10px] uppercase block font-sans text-subtext0 font-bold">
                SHA
              </span>
              <span className="text-xs text-text select-all font-semibold truncate block">
                {selectedCommit.commit_id}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopySha(selectedCommit.commit_id)}
              className="flex items-center gap-1 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-text text-xs  transition-colors shrink-0 cursor-pointer"
              title="Copy full SHA"
            >
              {copiedSha ? (
                <Check className="w-3.5 h-3.5 text-text" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-subtext0" />
              )}
              <span>{copiedSha ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Author Info */}
          <div className="flex items-start gap-2 p-2 bg-surface0/20  border border-surface0/40">
            <User className="w-4 h-4 text-subtext0 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-text">{selectedCommit.author}</div>
              <div className="text-[11px] text-subtext0 font-mono">
                {selectedCommit.author_mail ? `<${selectedCommit.author_mail}>` : '(no email)'}
              </div>
            </div>
          </div>

          {/* Date Info */}
          <div className="flex items-start gap-2 p-2 bg-surface0/20  border border-surface0/40">
            <Clock className="w-4 h-4 text-subtext0 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-text">
                {formatUnixDateTime(selectedCommit.author_time, selectedCommit.author_tz)}
              </div>
              <div className="text-[11px] text-subtext0">
                {formatUnixRelativeTime(selectedCommit.author_time)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-surface0">
          <button
            type="button"
            onClick={() => handleCopyCommitUrl(selectedCommit.commit_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs  transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-subtext0" />
            <span>Copy Remote Link</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCommit(null)}
            className="px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold  transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
