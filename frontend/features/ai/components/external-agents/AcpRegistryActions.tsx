import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft } from '../../../../common/components/icons/ChevronLeft';
import { Plus } from '../../../../common/components/icons/Plus';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import type { AcpRegistryResponse } from '../../types/AcpRegistryResponse';
import { AcpRegistryAbout } from '../AcpRegistryAbout';
import type { AcpRegistryActionsProps } from './AcpRegistryActionsProps';

export function AcpRegistryActions({
  onBackToOverview,
  setIsCustomOpen,
  isLoading,
  setError,
  setIsLoading,
  setRegistry,
  setSupportedBinaryTarget,
  String,
}: AcpRegistryActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {onBackToOverview ? (
        <button
          type="button"
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1 text-xs text-subtext0 transition-colors hover:text-text"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> AI overview
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AcpRegistryAbout />
        <button
          type="button"
          onClick={() => setIsCustomOpen(true)}
          className="flex items-center gap-1.5 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0"
        >
          <Plus className="h-3.5 w-3.5" /> Add custom
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setError(null);
            setIsLoading(true);
            void invoke<AcpRegistryResponse>('acp_fetch_registry')
              .then((result) => {
                setRegistry(result.agents);
                setSupportedBinaryTarget(result.supportedBinaryTarget ?? undefined);
              })
              .catch((cause) => setError(String(cause)))
              .finally(() => setIsLoading(false));
          }}
          className="flex items-center gap-1.5 border border-surface1 px-2.5 py-1.5 text-xs text-subtext0 hover:text-text disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
  );
}
