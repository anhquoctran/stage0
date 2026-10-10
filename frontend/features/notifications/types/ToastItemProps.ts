import { type AppNotification } from './AppNotification';

export interface ToastItemProps {
  toast: AppNotification;
  onDismiss: (id: string) => void;
}
