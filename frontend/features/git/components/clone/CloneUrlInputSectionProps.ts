import React from 'react';
import type { UrlValidationStatus } from '../../types/UrlValidationStatus';

export interface CloneUrlInputSectionProps {
  urlStatus: UrlValidationStatus;
  isCloning: boolean;
  remoteUrl: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  urlMessage: string | null;
}
