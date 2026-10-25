import type { PlatformServices } from '../../../common/services/ipc/contracts/PlatformServices';
import type { ApplicationServices } from './ApplicationServices';
import { getCommonServices } from '../../../common/services/getCommonServices';
import { createPreferencesDocumentService } from '../../../features/preferences/services/transport/createPreferencesDocumentService';
import { createNotificationTransportService } from '../../../features/notifications/services/transport/createNotificationTransportService';
import { createGitHistoryService } from '../../../features/git/services/transport/createGitHistoryService';
import { createApplicationService } from '../transport/createApplicationService';
import { createGitRepositoryService } from '../../../features/git/services/transport/createGitRepositoryService';
import { createSandboxService } from '../../../features/git/services/transport/createSandboxService';
import { createGitSyncService } from '../../../features/git/services/transport/createGitSyncService';
import { createGitFileService } from '../../../features/git/services/transport/createGitFileService';
import { createAiProviderService } from '../../../features/ai/services/transport/createAiProviderService';
import { createGuardrailService } from '../../../features/ai/services/transport/createGuardrailService';
import { createReviewService } from '../../../features/review/services/transport/createReviewService';
import { createDiscussionService } from '../../../features/virtual-mr/services/transport/createDiscussionService';
import { createVirtualMrService } from '../../../features/virtual-mr/services/transport/createVirtualMrService';
import { createRepositorySettingsService } from '../../../features/virtual-mr/services/transport/createRepositorySettingsService';
import { createGitRemoteService } from '../../../features/git/services/transport/createGitRemoteService';
import { createAboutService } from '../../../features/about/services/transport/createAboutService';
import { createGitCredentialService } from '../../../features/credentials/services/transport/createGitCredentialService';
import { createExternalAgentService } from '../../../features/ai/services/transport/createExternalAgentService';
import { createGitBinaryService } from '../../../features/git/services/transport/createGitBinaryService';
import { createSystemFontService } from '../../../features/preferences/services/transport/createSystemFontService';
import { createHarnessService } from '../../../features/review/services/transport/createHarnessService';
import { createPerformanceService } from '../../../features/performance/services/transport/createPerformanceService';
import { createDeviceAuthService } from '../../../features/ai/services/transport/createDeviceAuthService';

/** Compose ports without starting IPC, subscriptions, hydration or credential access. */
export function createApplicationServices(platform: PlatformServices): ApplicationServices {
  return {
    platform,
    ...getCommonServices(platform),
    preferences: createPreferencesDocumentService(platform.commands),
    notifications: createNotificationTransportService(platform.commands),
    gitHistory: createGitHistoryService(platform.commands),
    application: createApplicationService(platform.commands),
    gitRepositories: createGitRepositoryService(platform.commands),
    sandboxes: createSandboxService(platform.commands),
    gitSync: createGitSyncService(platform.commands),
    gitFiles: createGitFileService(platform.commands),
    aiProviders: createAiProviderService(platform.commands),
    guardrails: createGuardrailService(platform.commands),
    reviews: createReviewService(platform.commands),
    discussions: createDiscussionService(platform.commands),
    virtualMrs: createVirtualMrService(platform.commands),
    repositorySettings: createRepositorySettingsService(platform.commands),
    gitRemotes: createGitRemoteService(platform.commands),
    about: createAboutService(platform.commands),
    credentials: createGitCredentialService(platform.commands),
    externalAgents: createExternalAgentService(platform.commands),
    gitBinaries: createGitBinaryService(platform.commands),
    systemFonts: createSystemFontService(platform.commands),
    harness: createHarnessService(platform.commands),
    performance: createPerformanceService(platform.commands),
    deviceAuth: createDeviceAuthService(platform.commands),
  };
}
