/** Escape literal text used inside generated Markdown, including backslashes and link brackets. */
export function escapeMarkdownText(value: string): string {
  return value.replace(/\r\n?|\n/g, ' ').replace(/[\\`*_{}\[\]()<>!|&]/g, '\\$&');
}
