import { formatUnixDateTime, formatUnixRelativeTime } from '@/common/utils/dateTime';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import type { BlameLinesTableProps } from './BlameLinesTableProps';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';

export function BlameLinesTable({
  fontFamily,
  fontSize,
  lineSpacing,
  filteredLines,
  setSelectedCommit,
  enableLigatures,
}: BlameLinesTableProps) {
  useDateTimeLanguage();
  return (
    <div className="border border-surface0 rounded-sm overflow-hidden bg-base shadow-xs text-xs font-mono">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-surface0 bg-mantle text-[10px] text-subtext0 uppercase font-sans font-bold select-none">
            <th className="py-1.5 px-3 text-start w-20">Commit</th>
            <th className="py-1.5 px-2 text-start w-36">Author</th>
            <th className="py-1.5 px-2 text-start w-24">Date</th>
            <th className="py-1.5 px-2 text-end w-12 border-e border-surface0">Line</th>
            <th className="py-1.5 px-3 text-start">Content</th>
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
                      className="font-mono text-[11px] text-subtext1 hover:text-text hover:underline cursor-pointer flex items-center gap-1 rounded-sm"
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
                    <span title={`${commit.author} <${commit.author_mail}>`}>{commit.author}</span>
                  ) : null}
                </td>

                {/* Date (Relative) */}
                <td className="py-0.5 px-2 align-top whitespace-nowrap text-subtext0 select-none text-[11px]">
                  {isNewBlock && commit ? (
                    <span title={formatUnixDateTime(commit.author_time, commit.author_tz)}>
                      {formatUnixRelativeTime(commit.author_time)}
                    </span>
                  ) : null}
                </td>

                {/* Line Number */}
                <td className="py-0.5 px-2 align-top text-end text-subtext0 border-e border-surface0 select-none text-[11px]">
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
  );
}
