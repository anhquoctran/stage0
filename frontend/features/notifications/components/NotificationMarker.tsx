import { Bell } from '../../../common/components/icons/Bell';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { type AppNotification } from '../types/AppNotification';

export function NotificationMarker({ notification }: { notification: AppNotification }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  switch (notification.level) {
    case 'success':
      return <CheckCircle2 className={`${className} text-green`} />;
    case 'warning':
      return <Bell className={`${className} text-yellow`} />;
    case 'error':
      return <Bell className={`${className} text-red`} />;
    case 'update':
      return <Bell className={`${className} text-blue`} />;
    default:
      return <Bell className={`${className} text-subtext0`} />;
  }
}
