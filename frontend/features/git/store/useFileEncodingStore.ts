import { create } from 'zustand';

interface FileEncodingState {
  selections: Record<string, string | null>;
  setEncoding: (key: string, encoding: string | null) => void;
}

export const useFileEncodingStore = create<FileEncodingState>(set => ({
  selections: {},
  setEncoding: (key, encoding) => set(state => ({ selections: {
    ...state.selections, [key]: encoding,
  } })),
}));
