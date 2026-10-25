import { Channel, invoke } from '@tauri-apps/api/core';
import type { CommandTransport } from '../../contracts/CommandTransport';

export function createTauriCommands(): CommandTransport {
  return {
    executeCommand: (operation, input, options) => options === undefined
      ? input === undefined ? invoke(operation) : invoke(operation, input)
      : invoke(operation, input, options),
    executeWithProgress: (operation, input, onProgress, options) => {
      const channel = new Channel(onProgress);
      const payload = { ...input, onProgress: channel };
      return options === undefined ? invoke(operation, payload) : invoke(operation, payload, options);
    },
  };
}
