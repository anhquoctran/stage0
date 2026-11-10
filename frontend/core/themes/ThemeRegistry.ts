import type { ThemeDefinition } from './types/ThemeDefinition';
import { validateTheme } from './validateTheme';

/** Catalog boundary for built-ins and future data-only installed packages. */
export class ThemeRegistry {
  private readonly themes = new Map<string, ThemeDefinition>();
  private snapshot: readonly ThemeDefinition[] = Object.freeze([]);
  private readonly listeners = new Set<() => void>();

  register(input: unknown): ThemeDefinition {
    const definition = validateTheme(input);
    if (this.themes.has(definition.id)) throw new Error(`Theme already registered: ${definition.id}`);
    this.themes.set(definition.id, definition);
    this.snapshot = Object.freeze([...this.themes.values()]);
    for (const listener of this.listeners) listener();
    return definition;
  }

  get(id: string): ThemeDefinition | undefined { return this.themes.get(id); }
  list(kind?: ThemeDefinition['kind']): readonly ThemeDefinition[] {
    return kind ? this.snapshot.filter(theme => theme.kind === kind) : this.snapshot;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
}
