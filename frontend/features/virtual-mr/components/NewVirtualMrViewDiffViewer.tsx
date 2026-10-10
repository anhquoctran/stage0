import React from 'react';

export const NewVirtualMrViewDiffViewer = React.lazy(() =>
  import('../../git/components/DiffViewer').then(({ DiffViewer }) => ({ default: DiffViewer }))
);
