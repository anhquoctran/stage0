/** Calendar release windows are half-open UTC intervals, never rolling ages. */
export function releasePeriod(channel, releaseDate) {
  if (!/^\d{4}-\d\d-\d\d$/.test(releaseDate || '')) throw new Error('Use an ISO UTC release date');
  const end = new Date(`${releaseDate}T00:00:00.000Z`);
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== releaseDate) throw new Error('Invalid release date');
  const year = end.getUTCFullYear(), month = end.getUTCMonth();
  let start;
  if (channel === 'beta' && end.getUTCDate() === 27) start = new Date(Date.UTC(year, month - 1, 28));
  else if (channel === 'stable' && end.getUTCDate() === 1 && month % 3 === 0) start = new Date(Date.UTC(year, month - 3, 1));
  else throw new Error('Beta releases on day 27; Stable on January/April/July/October 1');
  return { channel, releaseDate, start: start.toISOString(), end: end.toISOString(), timeZone: 'UTC' };
}

export function inReleasePeriod(release, period) {
  const time = Date.parse(release.published_at);
  return !release.draft && Number.isFinite(time) && time >= Date.parse(period.start) && time < Date.parse(period.end);
}

export function assertPeriodClosed(period, now = new Date()) {
  if (!Number.isFinite(now.getTime()) || now.getTime() < Date.parse(period.end)) throw new Error('Release period has not closed; do not freeze an incomplete rollup');
}

export function assertReleaseDay(period, now = new Date()) {
  assertPeriodClosed(period, now);
  if (now.toISOString().slice(0, 10) !== period.releaseDate) throw new Error('Periodic release may only publish on its scheduled UTC release date');
}
