import { createPixels } from '../utils/createPixels';

export function PixelIdenticon({ seed }: { seed: number }) {
  const pixels = createPixels(seed);
  const hue = seed % 360;

  return (
    <svg
      viewBox="0 0 5 5"
      aria-hidden="true"
      className="h-full w-full"
      shapeRendering="crispEdges"
    >
      <rect width="5" height="5" fill="var(--color-surface0)" />
      {pixels.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={`hsl(${hue} 62% 62%)`} />
      ))}
    </svg>
  );
}
