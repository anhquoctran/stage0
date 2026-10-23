// Keep the focused text control/selection: menu buttons prevent mousedown focus.
export async function runMenuTextEditing(command: string) {
  if (command !== 'paste' || document.execCommand('paste')) {
    if (command !== 'paste') document.execCommand(command);
    return;
  }
  const target = document.activeElement;
  const text = await navigator.clipboard.readText();
  // A delayed clipboard permission prompt must not paste into a different field.
  if (document.activeElement === target) document.execCommand('insertText', false, text);
}
