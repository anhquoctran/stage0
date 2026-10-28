import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import type { ReviewConfigurationSectionProps } from './ReviewConfigurationSectionProps';

export function ReviewConfigurationSection({ session, close, running, cancel }: ReviewConfigurationSectionProps) {
  return (
    <div className="space-y-3 rounded-sm border border-surface1 bg-base p-3 text-xs">
      <div>
        <h3 className="font-semibold text-text">Request a review</h3>
        <p className="mt-1 leading-relaxed text-subtext0">
          Start a new discussion in the Overview tab, mention one of the assigned reviewers, then add{' '}
          <code className="rounded-sm bg-surface0 px-1">review</code>. Stage0 checks that reviewer’s open findings before starting a full review.
        </p>
      </div>
      {session?.reviewers.length ? (
        <p className="text-subtext1">
          Assigned reviewers: {session.reviewers.map((reviewer) => reviewer.agentName).join(', ')}
        </p>
      ) : (
        <p className="text-yellow">Assign an enabled reviewer to this MR before requesting a review.</p>
      )}
      <p className="text-subtext0">
        Eligible tracked source may be sent to the reviewer’s configured provider. Stage0 filters sensitive paths and redacts matching secret lines, but detection cannot catch every secret. ACP source sharing must be enabled in that reviewer’s settings.
      </p>
      <button
        type="button"
        className="text-primary underline rounded-sm"
        onClick={() => {
          close();
          usePreferencesStore.getState().openPreferences('ai-providers');
        }}
      >
        AI Preferences
      </button>
      {running && (
        <div className="flex flex-wrap gap-2 border-t border-surface0 pt-3">
          <button type="button" onClick={() => void cancel()} className="rounded-sm border border-surface1 px-3 py-2">
            Cancel review
          </button>
          <button type="button" onClick={close} className="rounded-sm border border-surface1 px-3 py-2">
            Run in background
          </button>
        </div>
      )}
    </div>
  );
}
