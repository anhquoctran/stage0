import React from 'react';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import type { AiProviderId } from '../types/AiProviderId';

export const ProviderDeleteModal: React.FC<{
  providerToDelete: AiProviderId | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isDeletingProvider: boolean;
  providerDeleteError: string | null;
  getProviderDisplayName: (id: AiProviderId) => string;
}> = ({
  providerToDelete,
  onClose,
  onConfirm,
  isDeletingProvider,
  providerDeleteError,
  getProviderDisplayName,
}) => {
  if (!providerToDelete) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="remove-provider-title" className="w-full max-w-md bg-mantle border border-surface0 shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 border border-red/40 bg-red/10 text-red flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </span>
          <div>
            <h4 id="remove-provider-title" className="text-sm font-bold text-text">Remove {getProviderDisplayName(providerToDelete)}?</h4>
            <p className="text-[11px] leading-relaxed text-subtext0 mt-1">
              This removes its provider entry and all saved connection settings. The saved API key in the OS credential store will also be deleted. In Preferences, the removal takes effect when you apply your changes.
            </p>
          </div>
        </div>

        {providerDeleteError && (
          <div role="alert" className="flex items-center gap-2 p-2.5 bg-red/10 border border-red/30 text-red text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{providerDeleteError}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
          <button type="button" disabled={isDeletingProvider} onClick={onClose} className="px-3 py-1.5 border border-surface1 text-subtext0 hover:text-text hover:bg-surface0 text-xs transition cursor-pointer disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={isDeletingProvider} onClick={() => void onConfirm()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red text-base text-xs font-semibold hover:brightness-110 transition cursor-pointer disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeletingProvider ? 'Removing…' : 'Remove provider'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

