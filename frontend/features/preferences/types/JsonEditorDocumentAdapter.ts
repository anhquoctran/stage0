import type { JsonEditorDocument } from './JsonEditorDocument';

/** Optional document owner for the existing Preferences JSONC editor surface. */
export interface JsonEditorDocumentAdapter {
  load(): Promise<JsonEditorDocument>;
  saveText(content: string, expectedRevision: string): Promise<JsonEditorDocument>;
  reset?(): Promise<JsonEditorDocument>;
}
