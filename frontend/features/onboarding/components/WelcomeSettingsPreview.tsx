import { keymapPlatform, resolveKeymap } from '../../../core/services/keymaps/catalog';
import { formatKeybinding } from '../../../core/services/keymaps/keystroke';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';

export function WelcomeSettingsPreview({ step, settings }: Omit<WelcomeSettingsProps, 'onChange'>) {
  const platform = keymapPlatform();
  if (step === 'theme') return <div className="overflow-hidden rounded-sm border border-surface0 bg-base">
    <div className="flex items-center gap-2 border-b border-surface0 bg-crust px-4 py-3 text-xs text-subtext0">
      <span className="h-2 w-2 rounded-full bg-brand" /> Stage0 · Theme preview
    </div>
    <div className="flex min-h-48">
      <div className="w-1/3 space-y-3 border-r border-surface0 bg-mantle p-4 text-xs text-subtext0">
        <p className="font-semibold text-text">Workspace</p><p>Branches</p><p>Files</p><p>Reviews</p>
      </div>
      <div className="flex-1 space-y-4 p-4">
        <h2 className="text-base font-semibold text-text">Review with clarity</h2>
        <p className="text-xs leading-relaxed text-subtext1">Your workspace follows the theme you choose.</p>
        <div className="rounded-sm bg-surface0 p-3 text-xs text-text">main → feature</div>
        <span className="inline-block rounded-sm bg-brand/10 px-2 py-1 text-xs text-brand">Ready to review</span>
      </div>
    </div>
  </div>;
  if (step === 'keymaps') {
    const commands = resolveKeymap(settings.keymap, platform)
      .filter((command) => ['open_repo', 'clone_repo', 'fetch', 'pull', 'preferences'].includes(command.id));
    return <div className="rounded-sm border border-surface0 bg-base p-5">
      <h2 className="mb-4 text-sm font-semibold">Your shortcuts</h2>
      <dl className="space-y-4">{commands.map((command) => (
        <div key={command.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm">
          <dt className="text-xs text-subtext1">{command.label}</dt>
          <dd className="rounded-sm bg-surface0 px-2 py-1 text-xs font-mono text-text">
            {command.keys.map((key) => formatKeybinding(key, platform === 'macos')).join(' / ') || 'Not assigned'}
          </dd>
        </div>
      ))}</dl>
      <p className="mt-5 text-xs text-subtext0">Shortcuts activate after your choices are saved.</p>
    </div>;
  }
  if (step === 'buffer-font') return <div className="overflow-hidden rounded-sm border border-surface0 bg-base">
    <div className="border-b border-surface0 px-4 py-3 text-xs text-subtext0">review.ts · Buffer preview</div>
    <pre className="diff-raw-viewer overflow-x-auto p-4">{'function review(branch) {\n  const ready = branch != null;\n  return ready && branch.isClean;\n}\n\n// Clear code, thoughtful reviews.'}</pre>
  </div>;
  if (step === 'markdown-font') return <div className="rounded-sm border border-surface0 bg-base p-5">
    <h2 className="mb-3 text-xs text-subtext0">Your merge request</h2>
    <textarea aria-label="Markdown writing preview" readOnly rows={4} value={'## Summary\nImprove the review workflow.\n\n- Keep changes easy to understand.'}
      className="markdown-editor-textarea mb-4 w-full resize-none rounded-sm border border-surface0 bg-crust p-3 text-xs text-text" />
    <div className="markdown-preview">
      <h2>Summary</h2><p>Improve the review workflow.</p>
      <ul><li>Keep changes easy to understand.</li></ul>
      <pre><code>git diff main...feature</code></pre>
    </div>
  </div>;
  return <div className="rounded-sm border border-surface0 bg-base p-6">
    <p className="text-[10px] uppercase tracking-widest text-subtext0">Stage0 · Workspace</p>
    <h2 className="mt-4 text-2xl font-semibold">A workspace that feels like you</h2>
    <p className="mt-3 text-sm leading-relaxed text-subtext1">Compare branches. Read clearly. Keep the conversation together.</p>
    <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-sm bg-surface0 px-3 py-2">Files changed</span><span className="rounded-sm bg-surface0 px-3 py-2">Review notes</span></div>
  </div>;
}
