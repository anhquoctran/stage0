export function createPixels(seed: number): Array<{ x: number; y: number }> {
  let state = seed || 0x9e3779b9;
  const pixels: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      if ((state & 1) === 1) {
        pixels.push({ x, y }, { x: 4 - x, y });
      }
    }
  }
  return pixels;
}
