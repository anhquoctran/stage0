import { CustomSelect } from '../../../common/components/CustomSelect';
import { Eye } from '../../../common/components/icons/Eye';
import { EyeOff } from '../../../common/components/icons/EyeOff';
import { Globe } from '../../../common/components/icons/Globe';
import { Lock } from '../../../common/components/icons/Lock';
import { Plus } from '../../../common/components/icons/Plus';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { Tag } from '../../../common/components/icons/Tag';
import { User } from '../../../common/components/icons/User';
import { X } from '../../../common/components/icons/X';
import type { AddGitCredentialModalProps } from './AddGitCredentialModalProps';

export function AddGitCredentialModal({
  handleSave,
  setIsAdding,
  setFormError,
  PROVIDER_PRESETS,
  handleProviderChange,
  provider,
  serverUrl,
  setServerUrl,
  accountName,
  setAccountName,
  tokenType,
  CREDENTIAL_TYPE_OPTIONS,
  setTokenType,
  label,
  setLabel,
  keyringName,
  showSecret,
  secret,
  setSecret,
  setShowSecret,
  isLoading,
}: AddGitCredentialModalProps) {
  return (
    <form
      onSubmit={handleSave}
      className="p-4 bg-surface0/60 border border-surface1 space-y-4 animate-in fade-in zoom-in-98 duration-150"
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface1/60">
        <span className="text-xs font-bold text-text flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-subtext0" />
          New Git Credential
        </span>
        <button
          type="button"
          onClick={() => {
            setIsAdding(false);
            setFormError(null);
          }}
          className="p-1 text-subtext0 hover:text-text rounded-sm cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-[11px] font-medium text-subtext0 mb-1.5">Git Provider</label>
        <div className="grid grid-cols-5 gap-1.5">
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`px-2.5 py-2 rounded-sm text-xs font-semibold border transition-all text-center cursor-pointer ${
                provider === p.id
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'bg-surface0/40 border-surface0/80 text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Host / Server URL */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Server / Host URL
          </label>
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://github.com"
              className="w-full ps-8 pe-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        </div>

        {/* Account / Username */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Account / Username <span className="text-red">*</span>
          </label>
          <div className="relative flex items-center">
            <User className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. octocat, john.doe"
              required
              className="w-full ps-8 pe-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Token Type */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Credential Type
          </label>
          <CustomSelect
            value={tokenType}
            options={CREDENTIAL_TYPE_OPTIONS}
            onChange={setTokenType}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label="Credential Type"
          />
        </div>

        {/* Label (Optional) */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Label <span className="text-subtext0/60 font-normal">(Optional)</span>
          </label>
          <div className="relative flex items-center">
            <Tag className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Work PAT, Personal GitHub"
              className="w-full ps-8 pe-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        </div>
      </div>

      {/* Secret / Token Input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-subtext0">
            Secret Token / Password <span className="text-red">*</span>
          </label>
          <span className="text-[10px] text-subtext0/70 font-mono">Secured in {keyringName}</span>
        </div>
        <div className="relative flex items-center">
          <Lock className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
          <input
            type={showSecret ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ghp_..., glpat-..., or account password"
            required
            className="w-full ps-8 pe-9 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute end-2.5 p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
            title={showSecret ? 'Hide secret' : 'Show secret'}
          >
            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface1/60 rounded-sm">
        <button
          type="button"
          onClick={() => {
            setIsAdding(false);
            setFormError(null);
          }}
          className="px-3 py-1.5 rounded-sm border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-sm transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-on-accent" />
              <span>Saving to {keyringName}...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-on-accent" />
              <span>Save to {keyringName}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
