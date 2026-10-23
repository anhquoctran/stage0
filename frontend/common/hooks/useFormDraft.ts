import { useCallback, useState, type SetStateAction } from 'react';

/** Local form state only: no persistence, subscriptions or implicit validation. */
export function useFormDraft<T extends object>(initial: T | (() => T)) {
  const [value, setValue] = useState<T>(initial);
  const setField = useCallback(<K extends keyof T>(field: K, next: SetStateAction<T[K]>) => {
    setValue((previous) => ({
      ...previous,
      [field]:
        typeof next === 'function' ? (next as (previous: T[K]) => T[K])(previous[field]) : next,
    }));
  }, []);
  return { value, setValue, setField };
}
