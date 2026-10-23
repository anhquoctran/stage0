import { AlertCircle } from '../../../../common/components/icons/AlertCircle';
import { Check } from '../../../../common/components/icons/Check';
import { Globe } from '../../../../common/components/icons/Globe';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import type { CloneUrlInputSectionProps } from './CloneUrlInputSectionProps';

export function CloneUrlInputSection({
  urlStatus,
  isCloning,
  remoteUrl,
  handleUrlChange,
  urlMessage,
}: CloneUrlInputSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-medium text-text">
          Repository URL <span className="text-red">*</span>
        </label>
        {urlStatus === 'validating' && (
          <span className="text-[11px] text-blue flex items-center gap-1 font-normal animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking...
          </span>
        )}
      </div>
      <div className="relative">
        <Globe
          className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            urlStatus === 'invalid'
              ? 'text-red'
              : urlStatus === 'valid'
                ? 'text-green'
                : 'text-subtext0'
          }`}
        />
        <input
          type="text"
          autoFocus
          disabled={isCloning}
          value={remoteUrl}
          onChange={handleUrlChange}
          placeholder="https://github.com/owner/repository.git or git@github.com:owner/repo.git"
          className={`w-full pl-9 pr-9 py-2 bg-surface0 border text-xs placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60 rounded-sm ${
            urlStatus === 'invalid'
              ? 'border-red text-red focus:border-red focus:ring-1 focus:ring-red'
              : urlStatus === 'valid'
                ? 'border-green text-text focus:border-green focus:ring-1 focus:ring-green'
                : 'border-surface1 text-text focus:border-blue focus:ring-1 focus:ring-blue'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {urlStatus === 'validating' && <Loader2 className="w-4 h-4 text-blue animate-spin" />}
          {urlStatus === 'valid' && <Check className="w-4 h-4 text-green" />}
          {urlStatus === 'invalid' && <AlertCircle className="w-4 h-4 text-red" />}
        </div>
      </div>

      {/* Validation Message Below Input */}
      {urlStatus === 'invalid' && (
        <p className="text-[11px] text-red mt-1.5 flex items-start gap-1.5 animate-in fade-in duration-150">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red" />
          <span className="leading-tight font-mono">{urlMessage}</span>
        </p>
      )}
      {urlStatus === 'valid' && (
        <p className="text-[11px] text-green mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5 shrink-0 text-green" />
          <span className="leading-tight">{urlMessage}</span>
        </p>
      )}
      {urlStatus === 'validating' && (
        <p className="text-[11px] text-subtext0 mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
          <Loader2 className="w-3 h-3 shrink-0 animate-spin text-blue" />
          <span className="leading-tight">{urlMessage}</span>
        </p>
      )}
      {urlStatus === 'idle' && (
        <p className="text-[10px] text-subtext0 mt-1">
          {urlMessage ||
            'Supports HTTPS and SSH URLs from GitHub, GitLab, Bitbucket, or self-hosted Git'}
        </p>
      )}
    </div>
  );
}
