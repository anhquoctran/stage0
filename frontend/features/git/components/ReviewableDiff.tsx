import React, { useRef } from 'react';
import { DiffView, DiffModeEnum, SplitSide, type DiffViewProps } from '@git-diff-view/react';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import type { VirtualMrDiscussion } from '../../virtual-mr/types/VirtualMrDiscussion';
import { DiscussionThread } from '../../virtual-mr/components/DiscussionThread';
import { getClickedDiffLine, getDiffCodeSnippet, groupInlineDiscussions } from '../utils/discussionDiff';
import { InlineDiscussionComposer } from './InlineDiscussionComposer';

export const ReviewableDiff: React.FC<{
  data: NonNullable<DiffViewProps<VirtualMrDiscussion[]>['data']>;
  filePath: string;
  oldCommit: string;
  newCommit: string;
  viewMode: 'split' | 'unified';
  theme: 'dark' | 'light';
  fontSize: number;
}> = ({ data, filePath, oldCommit, newCommit, viewMode, theme, fontSize }) => {
  const { getActiveSession } = useVirtualMrStore();
  const session = getActiveSession();
  const widget = useRef<Parameters<NonNullable<DiffViewProps<VirtualMrDiscussion[]>['onCreateUseWidgetHook']>>[0] | null>(null);
  const drafts = useRef(new Map<string, string>());
  const extendData = groupInlineDiscussions(session?.discussions ?? [], filePath, oldCommit, newCommit);
  return (
    <div className="reviewable-diff" onClick={(event) => {
      if (!session) return;
      const selected = getClickedDiffLine(event.target as Element);
      if (selected) widget.current?.getReadonlyState().setWidget({ lineNumber: selected.lineNumber, side: selected.side === 'left' ? SplitSide.old : SplitSide.new });
    }}>
      <DiffView<VirtualMrDiscussion[]> data={data} className="diff-viewer-container"
        diffViewMode={viewMode === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified}
        diffViewTheme={theme} diffViewHighlight diffViewWrap={false} diffViewFontSize={fontSize}
        diffViewAddWidget={!!session} onCreateUseWidgetHook={(hook) => { widget.current = hook; }}
        extendData={extendData}
        renderWidgetLine={({ lineNumber, side, onClose }) => {
          if (!session || lineNumber < 1) return null;
          const diffSide = side === SplitSide.old ? 'left' : 'right';
          const snippet = getDiffCodeSnippet(data.hunks, diffSide, lineNumber);
          if (!snippet) return null;
          const commitId = diffSide === 'left' ? oldCommit : newCommit;
          const key = `${session.id}:${filePath}:${diffSide}:${commitId}:${lineNumber}`;
          return <InlineDiscussionComposer key={key} session={session}
            filePath={filePath} side={diffSide} lineNumber={lineNumber} commitId={commitId}
            snippet={snippet} onClose={onClose} initialBody={drafts.current.get(key)}
            onDraftChange={(body) => { if (body) drafts.current.set(key, body); else drafts.current.delete(key); }} />;
        }}
        renderExtendLine={({ data: discussions }) => !session || !discussions?.length ? null : (
          <div className="space-y-2 bg-crust p-3 text-left font-sans text-text">
            {discussions.map((discussion) => <div key={discussion.id} className="border border-surface1 bg-mantle p-3">
              <DiscussionThread session={session} discussion={discussion} />
            </div>)}
          </div>
        )}
      />
    </div>
  );
};
