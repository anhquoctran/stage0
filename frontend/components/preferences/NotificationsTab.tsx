import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from '@/components/common/icons';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { NotificationChannel } from '../../types/notification';

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-[#cba6f7]' : 'bg-[#313244]'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-xs transition duration-200 ease-in-out ${
        checked ? 'translate-x-4.5 bg-[#11111b]' : 'translate-x-0.5 bg-[#a6adc8]'
      }`}
    />
  </button>
);

const categories: Array<{
  key: NotificationChannel;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: 'softwareUpdates',
    title: 'Software updates',
    description: 'New releases and update downloads.',
    icon: Sparkles,
  },
  {
    key: 'aiReview',
    title: 'AI code review',
    description: 'When an AI review or re-verification finishes.',
    icon: CheckCircle2,
  },
  {
    key: 'gitSync',
    title: 'Git watchers and sync',
    description: 'Remote changes, new branches, and sync events.',
    icon: RefreshCw,
  },
  {
    key: 'guardrails',
    title: 'Security guardrails',
    description: 'Elevated commands, access blocks, and policy violations.',
    icon: AlertTriangle,
  },
];

export const NotificationsTab: React.FC = () => {
  const { settings, updateChannel } = useNotificationStore();

  return (
    <div className="space-y-5 animate-in fade-in duration-100 select-none pb-6">
      <div>
        <h3 className="border-b border-[#313244]/50 pb-1 font-mono text-xs font-bold uppercase tracking-tight text-text">
          Notification categories
        </h3>
        <p className="pt-2 text-[11px] leading-relaxed text-subtext0">
          Choose which Stage0 events can show a toast. Position and dismissal are set by Stage0 for each event.
        </p>
      </div>

      <div>
        {categories.map(({ key, title, description, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-6 border-b border-[#313244]/40 py-3"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                <Icon className="h-3.5 w-3.5 text-subtext0" />
                <span>{title}</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-subtext0">{description}</div>
            </div>
            <ToggleSwitch
              checked={settings.channels[key]}
              onChange={(enabled) => updateChannel(key, enabled)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
