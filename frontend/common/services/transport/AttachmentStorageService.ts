import type { SavedImageResult } from './SavedImageResult';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface AttachmentStorageService {
  saveMrImageAttachment(input: {
    fileName: string;
    dataBase64: string;
    mimeType: string;
  }): Promise<SavedImageResult>;
}
