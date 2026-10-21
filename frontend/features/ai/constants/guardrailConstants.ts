import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';

export const SIMULATOR_TOOL_OPTIONS: CustomSelectOption<
  'execute_terminal_cmd' | 'read_file_range' | 'get_diff'
>[] = [
  { value: 'execute_terminal_cmd', label: 'execute_terminal_cmd' },
  { value: 'read_file_range', label: 'read_file_range' },
  { value: 'get_diff', label: 'get_diff' },
];

