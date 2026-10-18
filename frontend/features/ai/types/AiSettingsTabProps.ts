import type { AiPreferencesEditor } from './AiPreferencesEditor';

export interface AiSettingsTabProps {
  draftSettings?: AiPreferencesEditor;
  isPendingCommit?: boolean;
}
