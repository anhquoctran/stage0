export interface NotificationSettings {
  channels: {
    aiReview: boolean;
    mrStatus: boolean;
    gitSync: boolean;
    guardrails: boolean;
  };
}
