import type { BotCategory } from '../../../virtual-mr/types/BotCategory';

export interface BotPromptConfigFormProps {
  formCategory: BotCategory;
  formInstructions: string;
  setFormInstructions: (val: string) => void;
}
