import { useTranslation } from 'react-i18next';
import type { MrSyncState } from '../types/MrSyncState';
import type { ReviewSnapshot } from '../../review/types/ReviewSnapshot';

export function MrSyncNotice({ sync, reviewed }: { sync?: MrSyncState; reviewed?: ReviewSnapshot }) {
  const { t } = useTranslation();
  if (!sync) return null;
  const historical = reviewed && (reviewed.baseSha !== sync.baseSha || reviewed.headSha !== sync.headSha);
  const key = sync.refStatus === 'unavailable' ? 'unavailable' : reviewed
    ? historical ? 'historical' : null : sync.needsReview ? 'needsReview' : null;
  if (!key) return null;
  return <div role="status" className="mx-4 my-2 rounded-sm bg-yellow/10 px-3 py-2 text-xs text-yellow">
    {t(`virtualMr.sync.${key}`)}
  </div>;
}
