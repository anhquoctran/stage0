import type { SavedImageResult } from '../services/transport/SavedImageResult';
import { getCommonServices } from '../services/getCommonServices';
import { getPlatformServices } from '../services/ipc/platformServices';

import { notificationService } from '../../features/notifications/services/notificationService';
import i18n from '../../features/i18n/i18n';

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

export type { SavedImageResult } from '../services/transport/SavedImageResult';

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
        reject(new Error(i18n.t('attachments.readFailed')));
      }
    };
    reader.onerror = () => reject(reader.error || new Error(i18n.t('attachments.readFailed')));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates the image, reads its data URL, and saves it to the temporary attachments folder
 * through attachment storage when available. Browser fallback returns the data URL.
 */
export async function processAndSaveImage(file: File): Promise<SavedImageResult | null> {
  const fileName = file.name || `image_${Date.now()}.png`;

  if (!isAllowedImage(file)) {
    notificationService.notify({
      titleKey: 'attachments.unsupportedTitle',
      bodyKey: 'attachments.unsupportedBody',
      values: { fileName },
      level: 'warning',
      channel: 'guardrails',
    });
    return null;
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    notificationService.notify({
      titleKey: 'attachments.tooLargeTitle',
      bodyKey: 'attachments.tooLargeBody',
      values: { fileName },
      level: 'warning',
      channel: 'guardrails',
    });
    return null;
  }

  const dataUrl = await readBlobAsDataUrl(file);
  const mimeType = file.type || 'image/png';

  if (getPlatformServices().capabilities.attachments) {
    try {
      const saved = await getCommonServices().attachments.saveMrImageAttachment({
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
