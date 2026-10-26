import type { AiSettingsTabProps } from './AiSettingsTabProps';

export type ExternalAgentsTabProps = AiSettingsTabProps & {
  onBackToOverview?: () => void;
  isOnboarding?: boolean;
};
