/** All positions and dimensions are physical pixels; scaleFactor converts to logical pixels. */
export interface DisplayMonitor {
  name: string | null;
  scaleFactor: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  workArea: {
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
}
