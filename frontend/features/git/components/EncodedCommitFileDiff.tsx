import { useTranslation } from 'react-i18next';
import { useFileDiffEncoding } from '../hooks/useFileDiffEncoding';
import { CommitFileDiff } from './CommitFileDiff';
import { FileEncodingPicker } from './diff-viewer/FileEncodingPicker';
import type { ChangedFile } from '../types/ChangedFile';

export function EncodedCommitFileDiff({ file, rawDiff, repoPath, oldRef, newRef }: {
  file: ChangedFile; rawDiff: string; repoPath: string; oldRef: string | null; newRef: string;
}) {
  const { t } = useTranslation();
  const encoding = useFileDiffEncoding(repoPath, oldRef, newRef, file.path, file.old_path);
  const decodedFile = encoding.data ? { ...file, is_binary: false,
    additions: encoding.data.additions, deletions: encoding.data.deletions } : file;
  const notice = encoding.loading ? <p role="status" className="p-4 text-xs text-subtext0">{t('git.encoding.loading')}</p>
    : encoding.error ? <p role="alert" className="p-4 text-xs text-red whitespace-pre-wrap">{encoding.error}</p> : undefined;
  return <CommitFileDiff file={decodedFile} rawDiff={encoding.data?.raw_diff ?? rawDiff} notice={notice}
    controls={<FileEncodingPicker encoding={encoding.encoding} onChange={encoding.setEncoding} />} />;
}
