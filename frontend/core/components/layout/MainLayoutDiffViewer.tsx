import React from 'react';

export const MainLayoutDiffViewer = React.lazy(() =>
  import('../../../features/git/components/DiffViewer').then(({ DiffViewer }) => ({ default: DiffViewer }))
);
