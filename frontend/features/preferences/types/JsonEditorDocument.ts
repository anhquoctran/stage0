export interface JsonEditorDocument {
  content: string;
  revision: string;
  path: string;
  validationError?: string | null;
  publicationSequence?: number;
}
