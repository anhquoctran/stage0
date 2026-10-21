import { invoke, isTauri } from '@tauri-apps/api/core';
import { notificationService } from '../../features/notifications/services/notificationService';

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MiB

export interface SavedImageResult {
  fileName: string;
  filePath?: string;
  relativePath?: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

/**
 * Checks whether a file object has an allowed image extension or MIME type.
 */
export function isAllowedImage(file: { name?: string; type?: string }): boolean {
  if (file.type && ALLOWED_IMAGE_MIMES.has(file.type.toLowerCase())) {
    return true;
  }
  if (file.name) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Reads a Blob/File as a Base64 data URL string.
 */
export function readBlobAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates the image, reads its data URL, and saves it to the temporary attachments folder
 * in Tauri desktop mode. In web fallback mode, returns the data URL directly.
 */
export async function processAndSaveImage(file: File): Promise<SavedImageResult | null> {
  const fileName = file.name || `image_${Date.now()}.png`;

  if (!isAllowedImage(file)) {
    notificationService.notify({
      title: 'Unsupported file type',
      body: `File "${fileName}" was rejected. Only image files (PNG, JPG, GIF, WebP, SVG) are supported in this sandbox environment.`,
      level: 'warning',
      channel: 'guardrails',
    });
    return null;
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    notificationService.notify({
      title: 'File too large',
      body: `Image "${fileName}" exceeds the maximum allowed size of 15 MiB.`,
      level: 'warning',
      channel: 'guardrails',
    });
    return null;
  }

  const dataUrl = await readBlobAsDataUrl(file);
  const mimeType = file.type || 'image/png';

  if (isTauri()) {
    try {
      const saved = await invoke<SavedImageResult>('save_mr_image_attachment', {
        fileName,
        dataBase64: dataUrl,
        mimeType,
      });
      return saved;
    } catch (err) {
      console.warn('Failed to save image attachment to disk, using data URL fallback:', err);
    }
  }

  return {
    fileName,
    mimeType,
    sizeBytes: file.size,
    dataUrl,
    relativePath: `tmp/attachments/${fileName}`,
  };
}
