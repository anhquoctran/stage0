import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import type { ReviewFeedbackMemory } from '../types/ReviewFeedbackMemory';

/** Maintenance actions commit immediately; they are not repository-settings drafts. */
export function ReviewFeedbackMemories({ repoId }: { repoId: string }) {
  const { t } = useTranslation();
  const { reviews } = useApplicationServices();
  const [memories, setMemories] = useState<ReviewFeedbackMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await reviews.listReviewFeedbackMemories({ repoId });
      if (current === sequence.current) { setMemories(next); setError(''); }
    } catch {
      if (current === sequence.current) setError(t('review.memory.error'));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [repoId, reviews, t]);
  useEffect(() => {
    setLoading(true);
    setBusy(false);
    setMemories([]);
    void refresh();
    return () => { ++sequence.current; };
  }, [refresh]);
  async function forget(memoryId: string) {
    const current = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      await reviews.forgetReviewFeedback({ repoId, memoryId });
      if (current === sequence.current) {
        setMemories((items) => items.filter((m) => m.id !== memoryId));
      }
    } catch {
      if (current === sequence.current) setError(t('review.memory.error'));
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }
  return (
    <section className="rounded-sm bg-crust p-3 space-y-2 text-xs" aria-label={t('review.memory.title')}>
      <h3 className="font-semibold text-text">{t('review.memory.title')}</h3>
      <p className="text-subtext0">{t('review.memory.description')}</p>
      <p className="text-subtext0">{t('review.memory.immediate')}</p>
      {loading ? <p role="status">{t('common.loading')}</p> : memories.length === 0 && !error && (
        <p className="text-subtext0">{t('review.memory.empty')}</p>
      )}
      <div className="max-h-64 overflow-y-auto space-y-2 rounded-sm">
        {memories.map((memory) => (
          <div key={memory.id} className="flex gap-2 rounded-sm bg-base p-2">
            <details className="min-w-0 flex-1 rounded-sm">
              <summary className="cursor-pointer text-text break-words">{memory.filePath}: {memory.reason}</summary>
              <p className="mt-2 text-subtext0 whitespace-pre-wrap break-words">{memory.finding}</p>
              <blockquote className="mt-2 text-subtext1 whitespace-pre-wrap break-words">{memory.feedback}</blockquote>
            </details>
            <button type="button" disabled={busy || loading} onClick={() => void forget(memory.id)}
              aria-label={t('review.memory.forget')} title={t('review.memory.forget')}
              className="rounded-sm border-0 bg-surface0 text-subtext1 hover:text-red p-1.5 self-start disabled:opacity-50">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-red">{error}</p>}
    </section>
  );
}
