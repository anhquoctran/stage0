import type { AiConfig } from '../../ai/types/AiConfig';
import type { AiPreferencesEditor } from '../../ai/types/AiPreferencesEditor';
import type { AiPreferencesSnapshot } from '../../ai/types/AiPreferencesSnapshot';
import type { usePreferencesDraftSession } from './usePreferencesDraftSession';

export interface PreferencesChangeCountContext {
  session: ReturnType<typeof usePreferencesDraftSession>;
  aiDraft: AiPreferencesEditor;
  aiBaseline: AiPreferencesSnapshot;
  draftAiConfig: AiConfig;
}
