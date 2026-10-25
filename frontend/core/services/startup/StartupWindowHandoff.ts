/** Native preparation hides/resizes the window; reveal shows its ready content. */
export interface StartupWindowHandoff {
  prepare(): Promise<unknown>;
  reveal(): Promise<unknown>;
}
