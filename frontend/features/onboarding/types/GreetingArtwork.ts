/** Ordered pen centerlines, including separate pen lifts for dots and accents. */
export interface GreetingArtwork {
  strokeWidth: number;
  strokes: readonly { d: string; transform?: string }[];
  attribution?: string;
}
