import type { JsonEditorDocumentAdapter } from './JsonEditorDocumentAdapter';
export interface PreferencesJsonEditorProps {
  onClose: () => void;
  adapter?: JsonEditorDocumentAdapter;
  title?: string;
  description?: string;
  conflictMessage?: string;
}
