import type { AcpSessionConfigOption } from './AcpSessionConfigOption';

export interface AcpReviewerConfigState {
  options: AcpSessionConfigOption[];
  loading: boolean;
  error: string | null;
  validationError: string | null;
  retry: () => void;
  reset: () => void;
  updateOption: (option: AcpSessionConfigOption, next: string | boolean | undefined) => void;
}
