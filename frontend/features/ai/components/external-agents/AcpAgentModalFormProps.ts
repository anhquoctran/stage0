import React from 'react';

export interface AcpAgentModalFormProps {
  setIsCustomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addCustomAgent: (event: React.FormEvent) => void;
  error: string | null;
  customName: string;
  setCustomName: React.Dispatch<React.SetStateAction<string>>;
  customCommand: string;
  setCustomCommand: React.Dispatch<React.SetStateAction<string>>;
  customArgs: string;
  setCustomArgs: React.Dispatch<React.SetStateAction<string>>;
}
