import type { JsonEditorDocumentAdapter } from './JsonEditorDocumentAdapter';
export interface PreferencesJsonEditorProps {
  onClose: () => void;
  adapter?: JsonEditorDocumentAdapter;
  title?: string;
  backLabel?: string;
  description?: string;
  conflictMessage?: string;
}
