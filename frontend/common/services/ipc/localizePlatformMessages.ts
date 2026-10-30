import type { RequestOptions } from './contracts/RequestOptions';
import type { SubscriptionOptions } from './contracts/SubscriptionOptions';
import type { PlatformServices } from './contracts/PlatformServices';
import { BackendMessageError } from './BackendMessageError';
import { localizeBackendPayload, parseBackendMessage } from './backendMessages';

const instances = new WeakMap<PlatformServices, PlatformServices>();

export function localizePlatformMessages(platform: PlatformServices): PlatformServices {
  const existing = instances.get(platform);
  if (existing) return existing;
  const receive = <T,>(promise: Promise<T>): Promise<T> => Promise.resolve(promise).then(localizeBackendPayload).catch((error: unknown) => {
    if (parseBackendMessage(error)) throw new BackendMessageError(error as string);
    throw error;
  });
  const localized: PlatformServices = {
    ...platform,
    commands: {
      executeCommand: (operation, input, options) => receive(platform.commands.executeCommand(operation, input, options)),
      executeWithProgress: <T, P>(operation: string, input: Record<string, unknown>, onProgress: (progress: P) => void, options?: RequestOptions) => receive(platform.commands.executeWithProgress<T, P>(
        operation, input, (progress) => onProgress(localizeBackendPayload(progress)), options,
      )),
    },
    events: {
      subscribe: <T,>(name: string, handler: (payload: T) => void, options?: SubscriptionOptions) => platform.events.subscribe<T>(name,
        (payload) => handler(localizeBackendPayload(payload)), options),
    },
  };
  instances.set(platform, localized);
  instances.set(localized, localized);
  return localized;
}
