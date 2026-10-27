import type { AiPreferencesEditor } from '../../ai/types/AiPreferencesEditor';

export interface OnboardingReviewerSetupProps {
  draftSettings: AiPreferencesEditor;
  hasSavedRequiredReviewer: boolean;
  onAutoSave?: () => void | Promise<void>;
}
