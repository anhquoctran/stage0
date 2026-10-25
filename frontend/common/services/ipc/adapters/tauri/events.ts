import { listen } from '@tauri-apps/api/event';
import type { EventTarget } from '@tauri-apps/api/event';
import type { SubscriptionOptions } from '../../contracts/SubscriptionOptions';
import type { EventService } from '../../contracts/EventService';
import type { EventScope } from '../../contracts/EventScope';

function nativeTarget(target: string | EventScope): string | EventTarget {
  if (typeof target === 'string') return target;
  switch (target.kind) {
    case 'all': return { kind: 'Any' };
    case 'application': return { kind: 'App' };
    case 'label': return { kind: 'AnyLabel', label: target.label };
    case 'window': return { kind: 'Window', label: target.label };
    case 'webview': return { kind: 'Webview', label: target.label };
    case 'webview-window': return { kind: 'WebviewWindow', label: target.label };
  }
}

export function createTauriEvents(): EventService {
  return {
    subscribe<T>(name: string, receive: (payload: T) => void, options?: SubscriptionOptions) {
      return listen<T>(name, event => receive(event.payload),
        options?.target === undefined ? undefined : { target: nativeTarget(options.target) });
    },
  };
}
