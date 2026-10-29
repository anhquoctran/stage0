/** One shared seven-second cycle: write, hold, fade, then lift the pen. */
export function handwritingKeyframes(lengths: readonly number[]): Keyframe[][] {
  const weights = lengths.map((length) => Math.max(8, length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const pause = Math.min(0.004, 0.12 / weights.length);
  const writingTime = 0.57 - pause * weights.length;
  let cursor = 0.05;
  return weights.map((weight) => {
    const start = cursor;
    const end = start + writingTime * weight / total;
    cursor = end + pause;
    return [
      { offset: 0, strokeDashoffset: '1', opacity: 0 },
      { offset: start, strokeDashoffset: '1', opacity: 0 },
      { offset: start, strokeDashoffset: '1', opacity: 1 },
      { offset: end, strokeDashoffset: '0', opacity: 1 },
      { offset: 0.84, strokeDashoffset: '0', opacity: 1 },
      { offset: 0.96, strokeDashoffset: '0', opacity: 0 },
      { offset: 1, strokeDashoffset: '0', opacity: 0 },
    ];
  });
}
