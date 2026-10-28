import { useState } from 'react';
import { eventStroke, formatKeybinding, normalizeShortcut } from '../../../../core/services/keymaps/keystroke';
import { keymapErrors } from '../../../../core/services/keymaps/validation';
import type { KeymapBindingRowProps } from '../../types/KeymapBindingRowProps';

export function KeymapBindingRow({ command, settings, onChange, mac }: KeymapBindingRowProps) {
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [originalKeys, setOriginalKeys] = useState<string[] | null>(null);
  const customized = settings.overrides.some((item) => item.command === command.id);
  const withKeys = (keys: string[] | null) => ({
    ...settings,
    overrides: [...settings.overrides.filter((item) => item.command !== command.id), ...(keys ? [{ command: command.id, keys }] : [])],
  });
  const editText = (next: string) => {
    setText(next); setError('');
    onChange(withKeys(next.split(';').map((key) => key.trim()).filter(Boolean)));
  };
  const cancel = () => { onChange(withKeys(originalKeys)); setEditing(false); setRecording(false); setError(''); };
  const change = (keys: string[] | null) => {
    try {
      const next = withKeys(keys?.map((key) => normalizeShortcut(key)) ?? null);
      const errors = ['macos', 'windows', 'linux'].flatMap((platform) => keymapErrors(next, platform).map((message) => `${platform}: ${message}`));
      if (errors.length) { setError([...new Set(errors)].join(' ')); return; }
      onChange(next);
      setError('');
      setEditing(false);
      setRecording(false);
    } catch (failure) { setError((failure as Error).message); }
  };
  const buttonClass = 'rounded-sm border border-surface1 px-2 py-1 text-[11px] text-subtext1 hover:bg-surface0 disabled:opacity-40';
  return (
    <div className="rounded-sm px-3 py-2.5 even:bg-surface0/20">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text">{command.label}</p>
          <p className="font-mono text-[10px] text-subtext0">{command.id} · {command.scope}{customized ? ' · Customized' : ''}</p>
        </div>
        <div className="flex max-w-[50%] flex-wrap justify-end gap-1">
          {command.keys.length ? command.keys.map((key) => <kbd key={key} className="rounded-sm bg-crust px-1.5 py-1 font-mono text-[11px] text-subtext1">{formatKeybinding(key, mac)}</kbd>) : <span className="text-[11px] text-subtext0">Unassigned</span>}
        </div>
        {command.editable ? <button type="button" className={buttonClass} aria-label={`Edit ${command.label}`} onClick={() => {
          if (editing) { cancel(); return; }
          setOriginalKeys(settings.overrides.find((item) => item.command === command.id)?.keys ?? null);
          setText(command.keys.join('; ')); setEditing(!editing); setRecording(false); setError('');
        }}>Edit</button> : <span className="w-9 text-end text-[10px] text-subtext0" title="Managed by the OS or text control">System</span>}
      </div>
      {editing && <div className="mt-3 space-y-2 rounded-sm border border-surface1 bg-crust p-3">
        <label className="block text-[11px] text-subtext0" htmlFor={`binding-${command.id}`}>Shortcut(s), separated by semicolons · Empty disables this command</label>
        <div className="flex items-center gap-2">
          <input id={`binding-${command.id}`} value={text} readOnly={recording} autoFocus maxLength={520}
            placeholder={recording ? 'Press a shortcut, then optionally a second step…' : 'CmdOrCtrl+K CmdOrCtrl+S'}
            className="min-w-0 flex-1 rounded-sm border border-surface1 bg-base px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-brand"
            onChange={(event) => editText(event.target.value)}
            onBlur={() => setRecording(false)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
              if (!recording || event.key === 'Tab') { if (event.key === 'Tab') setRecording(false); return; }
              event.preventDefault();
              if (event.repeat || event.nativeEvent.isComposing) return;
              const stroke = eventStroke(event.nativeEvent, mac, true);
              if (!stroke) return;
              const next = [...steps, stroke].slice(0, 2);
              setSteps(next); editText(next.join(' '));
              if (next.length === 2) setRecording(false);
            }} />
          <button type="button" className={buttonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => {
            setRecording(!recording); setSteps([]); setError('');
            document.getElementById(`binding-${command.id}`)?.focus();
          }}>{recording ? 'Stop' : 'Record'}</button>
        </div>
        <p className="text-[10px] text-subtext0">CmdOrCtrl uses Command on macOS and Control elsewhere. Record replaces the field; type “;” to add alternatives. Chords time out after 1.5 seconds.</p>
        {error && <p role="alert" className="text-[11px] text-red">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => change(text.split(';').map((key) => key.trim()).filter(Boolean))}>Done</button>
          <button type="button" className={buttonClass} onClick={() => change([])}>Unassign</button>
          <button type="button" className={buttonClass} disabled={!customized} onClick={() => change(null)}>Use preset</button>
          <button type="button" className={buttonClass} onClick={cancel}>Cancel edit</button>
        </div>
      </div>}
    </div>
  );
}
