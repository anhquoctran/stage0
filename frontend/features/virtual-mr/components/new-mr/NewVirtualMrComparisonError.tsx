import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import type { NewVirtualMrComparisonErrorProps } from './NewVirtualMrComparisonErrorProps';

export function NewVirtualMrComparisonError({
  diffError,
  refreshDiff,
}: NewVirtualMrComparisonErrorProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
      <div className="w-12 h-12 bg-red/10 border border-red/30 flex items-center justify-center text-red mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-sm font-semibold text-text mb-1.5">Couldn't compare these branches</h2>
      <p className="text-xs text-subtext1 max-w-lg leading-relaxed mb-4">
        Check that both refs still exist and that the repository is available. Select valid
        branches, then retry.
      </p>
      <details className="max-w-xl w-full text-left text-xs text-subtext0 mb-4">
        <summary className="cursor-pointer hover:text-text">Git error details</summary>
        <pre className="mt-2 p-3 bg-crust border border-surface0 whitespace-pre-wrap break-words select-text">
          {diffError}
        </pre>
      </details>
      <button
        type="button"
        onClick={() => void refreshDiff()}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs transition-colors cursor-pointer rounded-sm"
      >
        <GitBranch className="w-3.5 h-3.5" />
        Retry comparison
      </button>
    </div>
  );
}
