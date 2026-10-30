import { Trans, useTranslation as useUiTextTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import type { ReviewConfigurationSectionProps } from './ReviewConfigurationSectionProps';

export function ReviewConfigurationSection({ session, close, running, cancel }: ReviewConfigurationSectionProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="space-y-3 rounded-sm border border-surface1 bg-base p-3 text-xs">
      <div>
        <h3 className="font-semibold text-text">{translateUiText('review.configuration.title')}</h3>
        <p className="mt-1 leading-relaxed text-subtext0">
          <Trans
            i18nKey="review.configuration.commandHint"
            components={{ code: <code className="rounded-sm bg-surface0 px-1" /> }}
          />
        </p>
      </div>
      {session?.reviewers.length ? (
          <p className="text-subtext1">{translateUiText('review.configuration.assignedReviewers', {
            names: session.reviewers.map((reviewer) => reviewer.agentName).join(', '),
          })}</p>
      ) : (
        <p className="text-yellow">{translateUiText('review.configuration.assignReviewer')}</p>
      )}
      <p className="text-subtext0">
        {translateUiText('review.configuration.sourceSharingNotice')}
      </p>
      <button
        type="button"
        className="text-primary underline rounded-sm"
        onClick={() => {
          close();
          usePreferencesStore.getState().openPreferences('ai-providers');
        }}
      >
        {translateUiText('review.configuration.aiPreferences')}
      </button>
      {running && (
        <div className="flex flex-wrap gap-2 border-t border-surface0 pt-3">
          <button type="button" onClick={() => void cancel()} className="rounded-sm border border-surface1 px-3 py-2">
            {translateUiText('review.configuration.cancelReview')}
          </button>
          <button type="button" onClick={close} className="rounded-sm border border-surface1 px-3 py-2">
            {translateUiText('review.configuration.runInBackground')}
          </button>
        </div>
      )}
    </div>
  );
}
