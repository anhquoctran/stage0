// Small hook runner with stable setters/memo dependencies; no UI or native calls.
export function hookHarness() {
  const slots = [];
  let cursor = 0;
  let pending = [];
  const changed = (previous, next) => !previous || !next ||
    previous.length !== next.length || next.some((value, index) => !Object.is(value, previous[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= {
        value: typeof initial === 'function' ? initial() : initial,
        setter(next) {
          const slot = slots[index];
          slot.value = typeof next === 'function' ? next(slot.value) : next;
        },
      };
      return [slots[index].value, slots[index].setter];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useMemo(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) {
        slots[index] = { value: callback(), dependencies };
      }
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) {
        const previous = slots[index];
        const next = { dependencies };
        slots[index] = next;
        pending.push(() => { previous?.cleanup?.(); next.cleanup = callback(); });
      }
    },
  };
  return {
    react: { ...react, default: react },
    render(hook, props) {
      cursor = 0;
      const result = hook(props);
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
      return result;
    },
    cleanup() { slots.forEach((slot) => slot.cleanup?.()); },
  };
}
