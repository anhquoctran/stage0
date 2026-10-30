import { Check } from '../../../../common/components/icons/Check';
import { Copy } from '../../../../common/components/icons/Copy';
import type { ConflictMarkedFileViewProps } from './ConflictMarkedFileViewProps';

export function ConflictMarkedFileView({
  selectedFile,
  handleCopy,
  activeConflictPreview,
  copiedKey,
  fontFamily,
  fontSize,
  lineSpacing,
  enableLigatures,
}: ConflictMarkedFileViewProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-6xl mx-auto border border-surface0 rounded-sm overflow-hidden bg-mantle shadow-sm">
      <div className="bg-surface0 px-3.5 py-2 border-b border-surface1 flex items-center justify-between rounded-sm">
        <span className="text-xs font-mono font-bold text-text">
          {t('git.conflicts.mergedFileTitle', { path: selectedFile.path })}
        </span>
        <button
          type="button"
          onClick={() => handleCopy(activeConflictPreview?.merged_content || '', 'full')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-sm bg-surface1 hover:bg-surface2 text-xs text-text transition-colors cursor-pointer"
          title={t('git.conflicts.copyMergedFile')}
        >
          {copiedKey === 'full' ? (
            <Check className="w-3 h-3 text-green" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span>{t('git.conflicts.copyFullFile')}</span>
        </button>
      </div>

      <div
        dir="ltr"
        style={{
          fontFamily: fontFamily || 'inherit',
          fontSize: fontSize ? `${fontSize}px` : '13px',
          lineHeight: lineSpacing || 1.5,
          fontVariantLigatures: enableLigatures ? 'normal' : 'none',
        }}
        className="p-3 font-mono text-xs overflow-x-auto divide-y divide-transparent"
      >
        {(activeConflictPreview?.merged_content || '').split('\n').map((line, idx) => {
          const isStart = line.startsWith('<<<<<<<');
          const isMid = line.startsWith('=======');
          const isEnd = line.startsWith('>>>>>>>');

          if (isStart) {
            return (
              <div
                key={idx}
                className="bg-red/25 text-red font-bold px-2 py-1 my-1 rounded-sm border-l-4 border-red flex items-center gap-2"
              >
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-sm bg-red text-white">
                  {t('git.conflicts.targetChange')}
                </span>
                <span>{line}</span>
              </div>
            );
          }

          if (isMid) {
            return (
              <div
                key={idx}
                className="bg-surface1 text-subtext1 font-bold px-2 py-0.5 my-1 border-y border-dashed border-surface2 flex items-center gap-2 text-center justify-center text-[11px] rounded-sm"
              >
                <span>{t('git.conflicts.collisionBoundary')}</span>
              </div>
            );
          }

          if (isEnd) {
            return (
              <div
                key={idx}
                className="bg-blue/25 text-blue font-bold px-2 py-1 my-1 rounded-sm border-l-4 border-blue flex items-center gap-2"
              >
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-sm bg-blue text-white">
                  {t('git.conflicts.incomingChange')}
                </span>
                <span>{line}</span>
              </div>
            );
          }

          return (
            <div key={idx} className="flex hover:bg-surface0/60 px-1 py-0.5 rounded-sm">
              <span className="w-12 text-subtext0 select-none text-right pr-3 shrink-0 text-[11px]">
                {idx + 1}
              </span>
              <span className="text-text whitespace-pre flex-1">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useTranslation } from 'react-i18next';
