import { type NotificationDismissPolicy } from '../types/NotificationDismissPolicy';

export function dismissesManually(policy: NotificationDismissPolicy) {
  return policy === 'manual' || policy === 'both';
}
