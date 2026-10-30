import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileJson } from '../../../common/components/icons/FileJson';
import { Plus } from '../../../common/components/icons/Plus';
import { HarnessConnectionsPanel } from '../../review/components/HarnessConnectionsPanel';
import { MCP_PRESET_TEMPLATES } from '../constants/aiPresets';
import { useAiMcpTabState } from '../hooks/useAiMcpTabState';
import type { AiMcpTabProps } from '../types/AiMcpTabProps';
import { getProviderDisplayName } from '../utils/getProviderDisplayName';
import { AiMcpPromptRolesView } from './AiMcpPromptRolesView';
import { AiMcpProviderDetailsModal } from './AiMcpProviderDetailsModal';
import { AiMcpProviderTable } from './AiMcpProviderTable';
import { AiMcpServersList } from './AiMcpServersList';
import { AiMcpTabHeader } from './AiMcpTabHeader';
import { McpJsonModal } from './McpJsonModal';
import { McpServerModal } from './McpServerModal';
import { ProviderDeleteModal } from './ProviderDeleteModal';
import { ProviderSetupModal } from './ProviderSetupModal';

export const AiMcpTab: React.FC<AiMcpTabProps> = ({
  draftSettings,
  draftAiConfig,
  onUpdateAiConfig,
  onNavigateToGuardrails,
  activeView,
  onBackToOverview,
}) => {
  const { t } = useTranslation();
  const state = useAiMcpTabState({
    draftSettings,
    draftAiConfig,
    onUpdateAiConfig,
    onNavigateToGuardrails,
    activeView,
    onBackToOverview,
  });

  return (
    <div className="space-y-4">
      <AiMcpTabHeader
        activeView={activeView}
        activeSubTab={state.navigation.activeSubTab}
        onBackToOverview={onBackToOverview}
        onSelectSubTab={state.navigation.setActiveSubTab}
        activeProviderName={getProviderDisplayName(
          state.provider.activeProviderPreset.id,
          state.provider.aiConfig.customProviderName
        )}
        activeModel={state.provider.aiConfig.model}
        enabledMcpCount={state.mcp.enabledMcpCount}
        totalMcpCount={state.mcp.mcpServers.length}
      />

      {/* VIEW: AI MODEL & PROVIDER CONFIGURATION */}
      {(activeView === 'providers' ||
        (!activeView &&
          (state.navigation.activeSubTab === 'ai' ||
            state.navigation.activeSubTab === 'guardrails'))) && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <AiMcpProviderTable
            configuredProviders={state.provider.configuredProviderList}
            activeProviderId={state.provider.aiConfig.provider}
            availableProviderList={state.provider.availableProviderList}
            aiConfig={state.provider.aiConfig}
            onOpenAddProvider={state.setup.openAddProvider}
            onOpenProviderDetails={state.details.openProviderDetails}
            onSelectProvider={state.provider.setProvider}
            onRequestDeleteProvider={(id) => {
              state.removal.setProviderDeleteError(null);
              state.removal.setProviderToDelete(id);
            }}
            isProviderConfigured={state.setup.isProviderConfigured}
          />

          <AiMcpProviderDetailsModal
            isOpen={state.details.isProviderDetailsOpen}
            onClose={state.details.closeProviderDetails}
            aiConfig={state.provider.aiConfig}
            activeProviderPreset={state.provider.activeProviderPreset}
            apiKeyDraft={state.provider.apiKeyDraft}
            setApiKeyDraft={state.provider.setApiKeyDraft}
            hasSavedApiKey={state.provider.hasSavedApiKey}
            apiKeysConfigured={state.provider.apiKeysConfigured}
            isCheckingApiKey={state.provider.isCheckingApiKey}
            apiKeyCheckError={state.provider.apiKeyCheckError}
            onLoadApiKey={state.provider.loadApiKeyForProvider}
            onUpdateAiConfig={state.provider.updateAiConfig}
            dynamicModels={state.provider.dynamicModels}
            isFetchingDynamicModels={state.provider.isFetchingDynamicModels}
            dynamicModelError={state.provider.dynamicModelError}
            onFetchDynamicModels={state.provider.fetchDynamicModels}
            onTestConnection={() =>
              void state.provider.testAiConnection(
                state.provider.aiConfig,
                state.provider.hasSavedApiKey || !!state.provider.apiKeyDraft.trim()
              )
            }
            isTestingAi={state.provider.isTestingAi}
            aiTestResult={state.provider.aiTestResult}
            onClearTestResult={state.provider.clearAiTestResult}
            onResetAiConfig={state.provider.resetAiConfig}
            hasDraftSettings={Boolean(draftSettings)}
          />

          {onNavigateToGuardrails && (
            <div className="pt-1 text-end">
              <button
                type="button"
                onClick={onNavigateToGuardrails}
                className="text-xs text-subtext0 hover:text-text underline cursor-pointer rounded-sm"
              >
                {t('ai.mcpTab.configureSecurityPolicies')} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MCP SERVERS (MODEL CONTEXT PROTOCOL) */}
      {state.navigation.activeSubTab === 'mcp' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <HarnessConnectionsPanel draftServers={draftSettings?.mcpServers} />

          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-text block">
                {t('ai.mcpTab.ecosystemTitle')}
              </span>
              <span className="text-[11px] text-subtext0 block">
                {t('ai.mcpTab.ecosystemDescription')}
              </span>
            </div>

            <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => state.mcp.setIsJsonModalOpen(true)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer rounded-sm"
                title={t('ai.mcpTab.importExportTitle')}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>{t('ai.mcpTab.configJson')}</span>
              </button>

              <button
                type="button"
                onClick={() => state.mcp.handleOpenAddServer()}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer shadow-xs rounded-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('ai.mcpTab.addServer')}</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Templates Bar */}
          <div className="p-2.5 bg-surface0/20 border border-surface0/80 flex flex-wrap items-center gap-2 rounded-sm">
            <span className="shrink-0 text-[10px] font-bold text-subtext0 uppercase tracking-wider">
              {t('ai.mcpTab.quickAddPresets')}
            </span>
            {MCP_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => state.mcp.handleOpenAddServer(preset)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-surface0 hover:bg-surface1 text-text transition-colors cursor-pointer rounded-sm"
              >
                <Plus className="w-3 h-3 text-subtext0" />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Add / Edit Server Drawer / Form */}
          <McpServerModal
            isOpen={state.mcp.isServerFormOpen}
            onClose={() => state.mcp.setIsServerFormOpen(false)}
            onSave={state.mcp.handleSaveServer}
            editingServerId={state.mcp.editingServerId}
            formError={state.mcp.formError}
            serverName={state.mcp.serverName}
            setServerName={state.mcp.setServerName}
            serverType={state.mcp.serverType}
            setServerType={state.mcp.setServerType}
            serverDesc={state.mcp.serverDesc}
            setServerDesc={state.mcp.setServerDesc}
            serverCommand={state.mcp.serverCommand}
            setServerCommand={state.mcp.setServerCommand}
            serverArgsStr={state.mcp.serverArgsStr}
            setServerArgsStr={state.mcp.setServerArgsStr}
            serverUrl={state.mcp.serverUrl}
            setServerUrl={state.mcp.setServerUrl}
            serverEnvPairs={state.mcp.serverEnvPairs}
            setServerEnvPairs={state.mcp.setServerEnvPairs}
          />

          {/* Servers Cards List */}
          <AiMcpServersList
            mcpServers={state.mcp.mcpServers}
            onOpenAddServer={state.mcp.handleOpenAddServer}
            onOpenEditServer={state.mcp.handleOpenEditServer}
            onToggleServer={state.mcp.toggleMcpServer}
            onTestServer={state.mcp.handleTestServer}
            onDeleteServer={state.mcp.deleteMcpServer}
            testingServerId={state.mcp.testingServerId}
            deletingServerId={state.mcp.deletingServerId}
            setDeletingServerId={state.mcp.setDeletingServerId}
          />
        </div>
      )}

      {/* SUB-TAB 3: STAGE0 MANAGED ROLE PROMPTS */}
      {state.navigation.activeSubTab === 'prompts' && (
        <AiMcpPromptRolesView
          reviewerInstructions={state.provider.aiConfig.reviewerInstructions}
          onUpdateReviewerInstructions={(reviewerInstructions) =>
            state.provider.updateAiConfig({ reviewerInstructions })
          }
        />
      )}

      {/* MODAL: ADD / EDIT LLM PROVIDER */}
      <ProviderSetupModal
        isOpen={state.setup.isProviderSetupOpen}
        onClose={() => state.setup.setIsProviderSetupOpen(false)}
        setupProviderId={state.setup.setupProviderId}
        setupProviderName={state.setup.setupProviderName}
        setSetupProviderName={state.setup.setSetupProviderName}
        setupApiKey={state.setup.setupApiKey}
        setSetupApiKey={state.setup.setSetupApiKey}
        setupBaseUrl={state.setup.setupBaseUrl}
        setSetupBaseUrl={state.setup.setSetupBaseUrl}
        providerSetupError={state.setup.providerSetupError}
        loadProviderSetup={state.setup.loadProviderSetup}
        handleSaveProviderSetup={state.setup.handleSaveProviderSetup}
        availableProviderList={state.provider.availableProviderList}
        getProviderDisplayName={(id) =>
          getProviderDisplayName(id, state.provider.aiConfig.customProviderName)
        }
        hasProviderApiKey={state.setup.hasProviderApiKey}
      />

      <ProviderDeleteModal
        providerToDelete={state.removal.providerToDelete}
        onClose={() => state.removal.setProviderToDelete(null)}
        onConfirm={state.removal.confirmRemoveProvider}
        isDeletingProvider={state.removal.isDeletingProvider}
        providerDeleteError={state.removal.providerDeleteError}
        getProviderDisplayName={(id) =>
          getProviderDisplayName(id, state.provider.aiConfig.customProviderName)
        }
      />

      <McpJsonModal
        isOpen={state.mcp.isJsonModalOpen}
        onClose={() => state.mcp.setIsJsonModalOpen(false)}
        exportMcpConfigFile={state.mcp.exportMcpConfigFile}
        importMcpConfigFile={state.mcp.importMcpConfigFile}
      />
    </div>
  );
};
