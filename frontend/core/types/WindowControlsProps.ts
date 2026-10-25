import type { WindowControlAction } from './WindowControlAction';

export interface WindowControlsProps {
  style?: 'windows' | 'mac' | 'auto';
  className?: string;
  buttons?: WindowControlAction[];
}
