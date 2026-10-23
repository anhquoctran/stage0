import { Key } from '../../../common/components/icons/Key';
import { Plus } from '../../../common/components/icons/Plus';
import type { GitCredentialsVaultBannerProps } from './GitCredentialsVaultBannerProps';

export function GitCredentialsVaultBanner({
  isAdding,
  setIsAdding,
  clearError,
  setFormError,
}: GitCredentialsVaultBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-3 border-b border-surface0 rounded-sm">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-text flex items-center gap-2">
          <Key className="w-4 h-4 text-subtext0" />
          Git Credentials Manager
        </h3>
        <p className="text-[11px] text-subtext0 mt-0.5">
          Stage0 credentials stay in your OS keychain. You can select one for a single HTTPS clone;
          it is not embedded in the URL or written to the repository/global Git config.
          System/global helpers are mapped from known remotes.
        </p>
      </div>

      {!isAdding && (
        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            clearError();
            setFormError(null);
          }}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-sm transition-colors cursor-pointer shadow-xs border border-brand"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Credential</span>
        </button>
      )}
    </div>
  );
}
