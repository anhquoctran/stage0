export interface NotificationSettings {
  channels: {
    softwareUpdates: boolean;
    aiReview: boolean;
    gitSync: boolean;
    guardrails: boolean;
  };
}
