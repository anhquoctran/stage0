import React from 'react';
import type { ExternalAgentsFilter as Filter } from '../../types/ExternalAgentsFilter';

export interface AcpRegistryToolbarProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
  filter: Filter;
}
