import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Info,
  RefreshCw,
  Trash2,
} from '@/components/common/icons';
import { useNotificationStore } from '../../store/useNotificationStore';
import { notificationService } from '../../services/notificationService';
import { CustomSelect, type CustomSelectOption } from '@/components/common/CustomSelect';

const TOAST_DURATION_OPTIONS: CustomSelectOption<string>[] = [
  {
    value: '3000',
    label: '3 Seconds',
    description: 'Fast auto-dismiss for quick notices',
  },
  {
    value: '5000',
    label: '5 Seconds (Default)',
    description: 'Standard duration recommended for general use',
  },
  {
    value: '10000',
    label: '10 Seconds',
    description: 'Extended visibility for longer messages',
  },
  {
    value: '0',
    label: 'Persistent',
    description: 'Requires clicking dismiss button manually',
  },
];

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
      disabled
        ? 'opacity-40 cursor-not-allowed bg-[#313244]'
        : checked
        ? 'bg-[#cba6f7]'
        : 'bg-[#313244]'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-xs transition duration-200 ease-in-out ${
        checked ? 'translate-x-4.5 bg-[#11111b]' : 'translate-x-0.5 bg-[#a6adc8]'
      }`}
    />
  </button>
);

export const NotificationsTab: React.FC = () => {
  const {
    settings,
    notifications,
    unreadCount,
    updateSettings,
    updateChannel,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void notificationService.isPermissionGranted().then((granted) => {
      if (mounted) setPermissionGranted(granted);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermissionGranted(granted);
  };

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    setTestSentMessage(null);

    try {
      await notificationService.notify({
        title: 'Stage0 Push Notification Test',
        body: 'Native desktop push and in-app alerts are active and working properly.',
        level: 'info',
        actions: [
          {
            label: 'Open Updates',
            actionType: 'open_preferences_updates',
          },
        ],
      });
      setTestSentMessage('Test notification sent');
      setTimeout(() => setTestSentMessage(null), 4000);
    } catch {
      setTestSentMessage('Failed to send test notification');
      setTimeout(() => setTestSentMessage(null), 4000);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-100 select-none pb-6">
      {/* 1. DELIVERY CONFIGURATION */}
      <div className="space-y-1">
        <h3 className="text-xs font-bold text-text tracking-tight uppercase font-mono pb-1 border-b border-[#313244]/50">
          Delivery Configuration
        </h3>

        {/* Row 1: OS Desktop Push Notifications */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text">OS Desktop Push Notifications</div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Dispatch native push alerts to your desktop when Stage0 is in the background or minimized.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.enableDesktopNotifications}
              onChange={(val) => updateSettings({ enableDesktopNotifications: val })}
            />
          </div>
        </div>

        {/* Row 2: In-App Toast Alerts */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text">In-App Floating Toast Alerts</div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Display animated floating notification banners in the window corner for instant feedback and quick action triggers.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.enableInAppToasts}
              onChange={(val) => updateSettings({ enableInAppToasts: val })}
            />
          </div>
        </div>

        {/* Row 3: Toast Duration Dropdown */}
        <div
          className={`py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40 transition-opacity duration-150 ${
            !settings.enableInAppToasts ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-2">
              <span>Toast Auto-Dismiss Duration</span>
              {!settings.enableInAppToasts && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#313244]/60 text-subtext0 border border-[#45475a]/40">
                  Disabled
                </span>
              )}
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              {settings.enableInAppToasts
                ? 'How long floating toast alerts remain on screen before automatically disappearing.'
                : 'In-app toasts are disabled above.'}
            </div>
          </div>
          <div className="shrink-0">
            <CustomSelect
              value={String(settings.toastDurationMs)}
              options={TOAST_DURATION_OPTIONS}
              onChange={(val) => updateSettings({ toastDurationMs: parseInt(val, 10) })}
              disabled={!settings.enableInAppToasts}
              buttonClassName="min-w-[160px]"
              dropdownWidth="w-64"
              align="right"
              aria-label="Toast Auto-Dismiss Duration"
            />
          </div>
        </div>

        {/* Row 4: Single test button & 1 line of status text (per user request) */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text">Test Desktop Notification</div>
            <div className="text-[11px] text-subtext0 mt-0.5 flex items-center gap-2">
              <span>OS Permission:</span>
              {permissionGranted ? (
                <span className="text-text font-medium">Granted</span>
              ) : permissionGranted === false ? (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="text-subtext0 hover:text-text underline cursor-pointer"
                >
                  Not Granted (Click to Request)
                </button>
              ) : (
                <span>Checking...</span>
              )}
              {testSentMessage && (
                <span className="text-subtext1 font-medium">• {testSentMessage}</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              disabled={isSendingTest}
              onClick={handleSendTestNotification}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text bg-[#313244] hover:bg-[#45475a] border border-[#45475a]/50 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSendingTest ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-subtext0" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-subtext0" />
                  <span>Send Test</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. EVENT NOTIFICATION CHANNELS */}
      <div className="space-y-1">
        <h3 className="text-xs font-bold text-text tracking-tight uppercase font-mono pb-1 border-b border-[#313244]/50">
          Event Notification Channels
        </h3>
        <p className="text-[11px] text-subtext0 pb-1 leading-relaxed">
          Fine-tune which application subsystems are permitted to deliver push and toast notifications.
        </p>

        {/* Channel 1: Software Updates */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-subtext0" />
              <span>Software Updates</span>
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Notify when version checks discover new releases or when automated background downloads finish.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.channels.softwareUpdates}
              onChange={(val) => updateChannel('softwareUpdates', val)}
            />
          </div>
        </div>

        {/* Channel 2: AI Code Review */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-subtext0" />
              <span>AI Code Reviewers &amp; Agents</span>
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Notify when AI Reviewer bots finish scanning Virtual MR diffs or complete re-verification on fixes.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.channels.aiReview}
              onChange={(val) => updateChannel('aiReview', val)}
            />
          </div>
        </div>

        {/* Channel 3: Git Watcher & Sync */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-subtext0" />
              <span>Git Watcher &amp; Remote Sync</span>
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Notify when background repository watchers detect remote changes, new branches, or sync events.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.channels.gitSync}
              onChange={(val) => updateChannel('gitSync', val)}
            />
          </div>
        </div>

        {/* Channel 4: Security & Guardrails */}
        <div className="py-3 flex items-center justify-between gap-6 border-b border-[#313244]/40">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-subtext0" />
              <span>Security Guardrails &amp; Policy Blocks</span>
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Alert immediately if an elevated command, unauthorized path access, or critical security violation is intercepted.
            </div>
          </div>
          <div className="shrink-0">
            <ToggleSwitch
              checked={settings.channels.guardrails}
              onChange={(val) => updateChannel('guardrails', val)}
            />
          </div>
        </div>
      </div>

      {/* 3. NOTIFICATION HISTORY */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1 border-b border-[#313244]/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-text tracking-tight uppercase font-mono">
              Notification History
            </h3>
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-[#313244]/80 text-subtext0">
              {notifications.length} stored {unreadCount > 0 && `• ${unreadCount} unread`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="px-2 py-1 text-[11px] text-subtext0 hover:text-text bg-[#313244]/50 hover:bg-[#313244] border border-[#45475a]/40 rounded transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-2 py-1 text-[11px] text-subtext0 hover:text-text bg-[#313244]/50 hover:bg-[#313244] border border-[#45475a]/40 rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center bg-[#11111b] border border-[#313244] rounded space-y-2">
            <Bell className="w-6 h-6 text-subtext0/40 mx-auto" />
            <div className="text-xs font-semibold text-text">No notifications recorded</div>
            <p className="text-[11px] text-subtext0 max-w-sm mx-auto leading-relaxed">
              When background processes, software updates, or AI reviewers generate alerts, they will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-[#313244]/30">
            {notifications.map((notif) => {
              const dateStr = new Date(notif.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={notif.id}
                  className={`pt-2 flex items-start gap-3 p-2.5 rounded transition-colors ${
                    notif.isRead
                      ? 'bg-[#11111b]/60 border border-transparent'
                      : 'bg-[#181825] border border-[#313244]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {notif.level === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-subtext0" />}
                    {notif.level === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-subtext0" />}
                    {notif.level === 'error' && <AlertCircle className="w-3.5 h-3.5 text-subtext0" />}
                    {notif.level === 'update' && <Sparkles className="w-3.5 h-3.5 text-subtext0" />}
                    {notif.level === 'info' && <Info className="w-3.5 h-3.5 text-subtext0" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-text truncate">{notif.title}</span>
                      <span className="text-[10px] text-subtext0 font-mono shrink-0">{dateStr}</span>
                    </div>
                    <p className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">{notif.body}</p>

                    {notif.actions && notif.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {notif.actions.map((act) => (
                          <button
                            key={act.label}
                            type="button"
                            onClick={() => notificationService.handleAction(act, notif.id)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#313244] hover:bg-[#45475a] text-text border border-[#45475a]/50 transition-colors cursor-pointer"
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
