import type { SubscriptionOptions } from './SubscriptionOptions';
import type { Unsubscribe } from './Unsubscribe';

export interface EventService {
  /** Registration is asynchronous. Each caller owns its returned unsubscribe. */
  subscribe<T>(name: string, receive: (payload: T) => void, options?: SubscriptionOptions): Promise<Unsubscribe>;
}
