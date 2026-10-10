import type { NotificationVariant } from './NotificationVariant';

/** Legacy levels remain accepted while existing call sites migrate to variants. */
export type NotificationLevel = NotificationVariant | 'info' | 'error' | 'update';
