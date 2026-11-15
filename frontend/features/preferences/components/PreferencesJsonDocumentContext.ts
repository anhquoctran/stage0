import type { JsonEditorDocumentAdapter } from '../types/JsonEditorDocumentAdapter';
export interface PreferencesJsonDocumentContext {
  onClose: () => void;
  adapter?: JsonEditorDocumentAdapter;
  conflictMessage?: string;
}
