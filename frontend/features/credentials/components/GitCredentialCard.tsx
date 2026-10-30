import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { Check } from '../../../common/components/icons/Check';
import { Copy } from '../../../common/components/icons/Copy';
import { Lock } from '../../../common/components/icons/Lock';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Server } from '../../../common/components/icons/Server';
import { ShieldAlert } from '../../../common/components/icons/ShieldAlert';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { Trash2 } from '../../../common/components/icons/Trash2';
import type { GitCredentialCardProps } from './GitCredentialCardProps';

export function GitCredentialCard({
  cred,
  handleVerify,
  verifyingId,
  deletingId,
  handleConfirmDelete,
  setDeletingId,
  handleCopyTokenRef,
  copiedId,
}: GitCredentialCardProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div
      key={cred.id}
      className="p-3.5 bg-surface0/30 border border-surface0 hover:border-surface1 transition-all space-y-3 rounded-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-surface1 border border-surface2 flex items-center justify-center text-text shadow-xs rounded-sm">
            <Server className="w-4 h-4 text-subtext0" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text">{cred.label || cred.account_name}</span>
              <span className="text-[10px] px-2 py-[0.2rem] bg-surface1 text-subtext0 border border-surface2 font-mono uppercase">
                {cred.provider}
              </span>
              <span className="text-[10px] px-1.5 py-[0.2rem] bg-surface0 text-subtext1 border border-surface1 font-mono uppercase">
                {cred.token_type}
              </span>
              <span className="text-[10px] px-1.5 py-[0.2rem] bg-surface0 text-subtext1 border border-surface1 font-mono uppercase">
                {cred.source === 'system_global' ? translateUiText('credentials.systemGlobal') : 'Stage0'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-subtext0 mt-0.5">
              <span>{cred.account_name}</span>
              <span>•</span>
              <span className="truncate max-w-[200px]">{cred.server_url}</span>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Keyring status pill */}
          <div
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium border bg-surface1 text-subtext0 border-surface2 rounded-sm"
            title={
              cred.source === 'system_global'
                ? translateUiText('credentials.helperFoundThrough', {
                    helper: cred.helper_name || translateUiText('credentials.systemGitHelper'),
                  })
                : cred.is_in_keyring
                  ? translateUiText('credentials.verifiedOsKeyring')
                  : translateUiText('credentials.secretMissingOsKeyring')
            }
          >
            {cred.source === 'system_global' ? (
              <>
                <ShieldCheck className="w-3 h-3 text-text" />
                <span className="text-text">{translateUiText('credentials.gitHelper')}</span>
              </>
            ) : cred.is_in_keyring ? (
              <>
                <ShieldCheck className="w-3 h-3 text-text" />
                <span className="text-text">{translateUiText('credentials.inOsKeyring')}</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3 text-subtext0" />
                <span>{translateUiText('credentials.keyringMissing')}</span>
              </>
            )}
          </div>

          {/* Verify button */}
          {cred.source === 'stage0' && (
            <button
              type="button"
              onClick={() => handleVerify(cred.id)}
              disabled={verifyingId === cred.id}
              className="p-1.5 rounded-sm border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
              title={translateUiText('credentials.verifySecretInOsKeyring')}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${verifyingId === cred.id ? 'animate-spin text-text' : ''}`}
              />
            </button>
          )}

          {/* Delete button */}
          {cred.source === 'stage0' && deletingId === cred.id ? (
            <div className="flex items-center gap-1 bg-surface1 p-0.5 border border-red/40 rounded-sm">
              <button
                type="button"
                onClick={() => handleConfirmDelete(cred.id)}
                className="px-2 py-0.5 bg-red/20 hover:bg-red/30 text-red text-[11px] font-medium rounded-sm transition-colors cursor-pointer"
              >
                {translateUiText('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-1.5 py-0.5 text-subtext0 hover:text-text text-[11px] rounded-sm transition-colors cursor-pointer"
              >
                {translateUiText('common.cancel')}
              </button>
            </div>
          ) : cred.source === 'stage0' ? (
            <button
              type="button"
              onClick={() => setDeletingId(cred.id)}
              className="p-1.5 rounded-sm border border-surface1 hover:bg-red/10 text-subtext0 hover:text-red transition-colors cursor-pointer"
              title={translateUiText('credentials.deleteCredentialTitle')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Tokenized Reference Mapping Info */}
      <div className="p-2 bg-base/50 border border-surface0 flex items-center justify-between text-[11px] rounded-sm">
        <div className="flex items-center gap-1.5 text-subtext0 font-mono">
          <Lock className="w-3 h-3 text-subtext0" />
          <span>{translateUiText('credentials.tokenizedRef')}</span>
          <span className="text-text font-bold select-all">{cred.token_ref}</span>
        </div>

        <button
          type="button"
          onClick={() => handleCopyTokenRef(cred.token_ref, cred.id)}
          className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-1.5 py-0.5 rounded-sm hover:bg-surface1 transition-colors cursor-pointer"
          title={translateUiText('credentials.copyTokenizedReference')}
        >
          {copiedId === cred.id ? (
            <>
              <Check className="w-3 h-3 text-text" />
              <span className="text-text">{translateUiText('credentials.copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{translateUiText('credentials.copyRef')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
