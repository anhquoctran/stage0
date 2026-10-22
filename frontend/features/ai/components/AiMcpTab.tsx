import React from 'react';
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
  const {
    apiKeysConfigured,
    isCheckingApiKey,
    apiKeyCheckError,
    mcpServers,
    isTestingAi,
    aiTestResult,
    activeSubTab,
    setActiveSubTab,
    loadApiKeyForProvider,
    testAiConnection,
    clearAiTestResult,
    dynamicModels,
    isFetchingDynamicModels,
    dynamicModelError,
    fetchDynamicModels,
    deleteMcpServer,
    toggleMcpServer,
    importMcpConfigFile,
    exportMcpConfigFile,
    aiConfig,
    updateAiConfig,
    setProvider,
    resetAiConfig,
    apiKeyDraft,
    setApiKeyDraft,
    isProviderDetailsOpen,
    isProviderSetupOpen,
    setIsProviderSetupOpen,
    setupProviderId,
    setupProviderName,
    setSetupProviderName,
    setupModel,
    setSetupModel,
    setupBaseUrl,
    setSetupBaseUrl,
    setupApiKey,
    setSetupApiKey,
    providerSetupError,
    providerToDelete,
    setProviderToDelete,
    providerDeleteError,
    setProviderDeleteError,
    isDeletingProvider,
    testingServerId,
    deletingServerId,
    setDeletingServerId,
    openProviderDetails,
    closeProviderDetails,
    isServerFormOpen,
    setIsServerFormOpen,
    editingServerId,
    serverName,
    setServerName,
    serverDesc,
    setServerDesc,
    serverType,
    setServerType,
    serverCommand,
    setServerCommand,
    serverArgsStr,
    setServerArgsStr,
    serverUrl,
    setServerUrl,
    serverEnvPairs,
    setServerEnvPairs,
    formError,
    isJsonModalOpen,
    setIsJsonModalOpen,
    activeProviderPreset,
    configuredProviderList,
    availableProviderList,
    hasSavedApiKey,
    enabledMcpCount,
    handleOpenAddServer,
    handleOpenEditServer,
    handleSaveServer,
    handleTestServer,
    hasProviderApiKey,
    isProviderConfigured,
    loadProviderSetup,
    openAddProvider,
    handleSaveProviderSetup,
    confirmRemoveProvider,
  } = useAiMcpTabState({
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
        activeSubTab={activeSubTab}
        onBackToOverview={onBackToOverview}
        onSelectSubTab={setActiveSubTab}
        activeProviderName={getProviderDisplayName(
          activeProviderPreset.id,
          aiConfig.customProviderName
        )}
        activeModel={aiConfig.model}
        enabledMcpCount={enabledMcpCount}
        totalMcpCount={mcpServers.length}
      />

      {/* VIEW: AI MODEL & PROVIDER CONFIGURATION */}
      {(activeView === 'providers' ||
        (!activeView && (activeSubTab === 'ai' || activeSubTab === 'guardrails'))) && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <AiMcpProviderTable
            configuredProviders={configuredProviderList}
            activeProviderId={aiConfig.provider}
            availableProviderList={availableProviderList}
            aiConfig={aiConfig}
            onOpenAddProvider={openAddProvider}
            onOpenProviderDetails={openProviderDetails}
            onSelectProvider={setProvider}
            onRequestDeleteProvider={(id) => {
              setProviderDeleteError(null);
              setProviderToDelete(id);
            }}
            isProviderConfigured={isProviderConfigured}
          />

          <AiMcpProviderDetailsModal
            isOpen={isProviderDetailsOpen}
            onClose={closeProviderDetails}
            aiConfig={aiConfig}
            activeProviderPreset={activeProviderPreset}
            apiKeyDraft={apiKeyDraft}
            setApiKeyDraft={setApiKeyDraft}
            hasSavedApiKey={hasSavedApiKey}
            apiKeysConfigured={apiKeysConfigured}
            isCheckingApiKey={isCheckingApiKey}
            apiKeyCheckError={apiKeyCheckError}
            onLoadApiKey={loadApiKeyForProvider}
            onUpdateAiConfig={updateAiConfig}
            dynamicModels={dynamicModels}
            isFetchingDynamicModels={isFetchingDynamicModels}
            dynamicModelError={dynamicModelError}
            onFetchDynamicModels={fetchDynamicModels}
            onTestConnection={() =>
              void testAiConnection(aiConfig, hasSavedApiKey || !!apiKeyDraft.trim())
            }
            isTestingAi={isTestingAi}
            aiTestResult={aiTestResult}
            onClearTestResult={clearAiTestResult}
            onResetAiConfig={resetAiConfig}
            hasDraftSettings={Boolean(draftSettings)}
          />

          {onNavigateToGuardrails && (
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={onNavigateToGuardrails}
                className="text-xs text-subtext0 hover:text-text underline cursor-pointer"
              >
                Configure AI Security Guardrails &amp; Execution Policies →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MCP SERVERS (MODEL CONTEXT PROTOCOL) */}
      {activeSubTab === 'mcp' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          <HarnessConnectionsPanel draftServers={draftSettings?.mcpServers} />

          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-text block">
                Model Context Protocol (MCP) Ecosystem
              </span>
              <span className="text-[11px] text-subtext0 block">
                Configure external tools; discovery does not grant access to AI review runs
              </span>
            </div>

            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(true)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
                title="Import or Export JSON configuration"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Config JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddServer()}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer shadow-xs border border-surface2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add MCP Server</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Templates Bar */}
          <div className="p-2.5 bg-surface0/20 border border-surface0/80 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold text-subtext0 uppercase tracking-wider">
              Quick Add Presets:
            </span>
            {MCP_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleOpenAddServer(preset)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-surface0 border border-surface1 hover:bg-surface1 text-text transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-subtext0" />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Add / Edit Server Drawer / Form */}
          <McpServerModal
            isOpen={isServerFormOpen}
            onClose={() => setIsServerFormOpen(false)}
            onSave={handleSaveServer}
            editingServerId={editingServerId}
            formError={formError}
            serverName={serverName}
            setServerName={setServerName}
            serverType={serverType}
            setServerType={setServerType}
            serverDesc={serverDesc}
            setServerDesc={setServerDesc}
            serverCommand={serverCommand}
            setServerCommand={setServerCommand}
            serverArgsStr={serverArgsStr}
            setServerArgsStr={setServerArgsStr}
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
            serverEnvPairs={serverEnvPairs}
            setServerEnvPairs={setServerEnvPairs}
          />

          {/* Servers Cards List */}
          <AiMcpServersList
            mcpServers={mcpServers}
            onOpenAddServer={handleOpenAddServer}
            onOpenEditServer={handleOpenEditServer}
            onToggleServer={toggleMcpServer}
            onTestServer={handleTestServer}
            onDeleteServer={deleteMcpServer}
            testingServerId={testingServerId}
            deletingServerId={deletingServerId}
            setDeletingServerId={setDeletingServerId}
          />
        </div>
      )}

      {/* SUB-TAB 3: STAGE0 MANAGED ROLE PROMPTS */}
      {activeSubTab === 'prompts' && (
        <AiMcpPromptRolesView
          reviewerInstructions={aiConfig.reviewerInstructions}
          onUpdateReviewerInstructions={(reviewerInstructions) =>
            updateAiConfig({ reviewerInstructions })
          }
        />
      )}

      {/* MODAL: ADD / EDIT LLM PROVIDER */}
      <ProviderSetupModal
        isOpen={isProviderSetupOpen}
        onClose={() => setIsProviderSetupOpen(false)}
        setupProviderId={setupProviderId}
        setupProviderName={setupProviderName}
        setSetupProviderName={setSetupProviderName}
        setupApiKey={setupApiKey}
        setSetupApiKey={setSetupApiKey}
        setupBaseUrl={setupBaseUrl}
        setSetupBaseUrl={setSetupBaseUrl}
        setupModel={setupModel}
        setSetupModel={setSetupModel}
        providerSetupError={providerSetupError}
        loadProviderSetup={loadProviderSetup}
        handleSaveProviderSetup={handleSaveProviderSetup}
        availableProviderList={availableProviderList}
        getProviderDisplayName={(id) => getProviderDisplayName(id, aiConfig.customProviderName)}
        hasProviderApiKey={hasProviderApiKey}
      />

      <ProviderDeleteModal
        providerToDelete={providerToDelete}
        onClose={() => setProviderToDelete(null)}
        onConfirm={confirmRemoveProvider}
        isDeletingProvider={isDeletingProvider}
        providerDeleteError={providerDeleteError}
        getProviderDisplayName={(id) => getProviderDisplayName(id, aiConfig.customProviderName)}
      />

      <McpJsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        exportMcpConfigFile={exportMcpConfigFile}
        importMcpConfigFile={importMcpConfigFile}
      />
    </div>
  );
};
