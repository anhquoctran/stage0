import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import { FileText } from '../../../common/components/icons/FileText';
import { X } from '../../../common/components/icons/X';
import { MarkdownPreview } from '../../../common/components/MarkdownPreview';
import { useAboutInfo } from '../hooks/useAboutInfo';
import { useReleaseNotes } from '../hooks/useReleaseNotes';
import type { ReleaseNotesModalProps } from '../types/ReleaseNotesModalProps';

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
  content,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  const about = useAboutInfo();
  const markdownContent = useReleaseNotes(content);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative bg-base border border-surface0 max-w-4xl xl:max-w-5xl w-full h-[720px] max-h-[88vh] shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col cursor-default text-text overflow-hidden rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-surface0 bg-mantle/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-brand/15 text-brand flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text">Release Notes</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-surface1 text-subtext0 border border-surface2">
                v{about.packageVersion}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
            title={translateUiText('shortcuts.close')}
            aria-label="Close Release Notes dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Rich Markdown Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8 text-xs text-text leading-relaxed select-text">
          <MarkdownPreview
            content={markdownContent}
            emptyPlaceholder="No release notes available for this version."
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-surface0 bg-mantle/50 shrink-0">
          <span className="text-[11px] text-subtext0 font-mono">
            Stage0 v{about.packageVersion} &bull; Current Version Release Notes
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold rounded-sm transition-colors cursor-pointer"
          >
            {translateUiText('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
