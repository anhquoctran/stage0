import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { PreferencesDocumentService } from './PreferencesDocumentService';

export function createPreferencesDocumentService(transport: CommandTransport): PreferencesDocumentService {
  return {
    commitPreferencesTransaction: (input) => transport.executeCommand('commit_preferences_transaction', input),
    initializePreferences: (input) => transport.executeCommand('initialize_preferences', input),
    loadPreferencesJson: () => transport.executeCommand('load_preferences_json'),
    patchPreferences: (input) => transport.executeCommand('patch_preferences', input),
    resetPreferencesJson: () => transport.executeCommand('reset_preferences_json'),
    savePreferencesJson: (input) => transport.executeCommand('save_preferences_json', input),
  };
}
