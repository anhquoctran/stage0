import type { CommandTransport } from '../ipc/contracts/CommandTransport';
import type { AttachmentStorageService } from './AttachmentStorageService';

export function createAttachmentStorageService(transport: CommandTransport): AttachmentStorageService {
  return {
    saveMrImageAttachment: (input) => transport.executeCommand('save_mr_image_attachment', input),
  };
}
