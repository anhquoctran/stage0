import { WELCOME_ARTWORK_SCENES } from '../constants/welcomeArtworkScenes';
import type { WelcomeArtworkSceneProps } from '../types/WelcomeArtworkSceneProps';

export function WelcomeArtworkScene({ step, children }: WelcomeArtworkSceneProps) {
  const scene = WELCOME_ARTWORK_SCENES[step];
  return <div className="space-y-6 rounded-sm">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-subtext0">
        <span className="stage0-welcome-pulse h-1.5 w-1.5 rounded-full bg-mauve" /> Sample workspace
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-text lg:text-2xl">{scene.title}</h2>
      <p className="max-w-lg text-xs leading-5 text-subtext0">{scene.description}</p>
    </div>
    <div className="relative rounded-sm">
      <div aria-hidden="true" className="stage0-welcome-halo pointer-events-none absolute -inset-5 rounded-full" />
      <div className="relative rounded-sm">{children}</div>
    </div>
    <dl className="grid grid-cols-3 gap-3">
      {scene.metrics.map((metric) => <div key={metric.label} className="rounded-sm bg-base p-3 lg:p-4">
        <dt className="text-[10px] text-subtext0 lg:text-xs">{metric.label}</dt>
        <dd className="mt-1 text-xl font-semibold font-mono text-text">{metric.value}</dd>
      </div>)}
    </dl>
    <ol className="flex items-start gap-2" aria-label="Example review workflow">
      {scene.steps.map((label, index) => <li key={label} className="flex min-w-0 flex-1 items-start gap-2 rounded-sm">
        <div className="min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface0 text-[10px] font-mono text-subtext1">{index + 1}</span>
          <p className="mt-2 text-[10px] text-subtext1 lg:text-xs">{label}</p>
        </div>
        {index < scene.steps.length - 1 && <span aria-hidden="true" className="stage0-welcome-connector mt-3 h-px flex-1 bg-surface1" />}
      </li>)}
    </ol>
  </div>;
}
