import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import type { DateInput } from '../types/DateInput';

dayjs.extend(utc);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

function validDate(value: DateInput) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
      return dayjs.utc(trimmed);
    }
  }
  const date = dayjs(value);
  return date.isValid() ? date : null;
}

/** Numeric inputs are Unix milliseconds; use the Unix-second helpers for Git timestamps. */
export function formatTime(value: DateInput, withSeconds = false): string {
  const date = validDate(value);
  return date?.format(withSeconds ? 'LTS' : 'LT') ?? '';
}

export function formatDate(value: DateInput): string {
  return validDate(value)?.format('L') ?? '';
}

export function formatDateTime(value: DateInput): string {
  return validDate(value)?.format('L LT') ?? '';
}

/** Compact relative time for narrow Git/MR UI, with future dates clamped to now. */
export function formatRelativeTime(value: DateInput): string {
  const date = validDate(value);
  if (!date) return '';
  return date.fromNow();
}

export function formatRecentTime(value: DateInput): string {
  const date = validDate(value);
  if (!date) return '';
  return dayjs().diff(date, 'day') >= 30 ? formatDate(value) : formatRelativeTime(value);
}

export function formatUnixRelativeTime(epochSeconds: number): string {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return '';
  return formatRelativeTime(dayjs.unix(epochSeconds).valueOf());
}

export function formatUnixDateTime(epochSeconds: number, timezone?: string): string {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return '';
  const offset = timezone?.match(/^([+-])(\d{2})(\d{2})$/);
  if (!offset) return formatDateTime(dayjs.unix(epochSeconds).valueOf());
  const hours = Number(offset[2]);
  const minutes = Number(offset[3]);
  if (hours > 23 || minutes > 59) return formatDateTime(dayjs.unix(epochSeconds).valueOf());
  const offsetMinutes = (hours * 60 + minutes) * (offset[1] === '-' ? -1 : 1);
  const localAtCommit = dayjs.unix(epochSeconds).utc().add(offsetMinutes, 'minute');
  return `${localAtCommit.format('L LT')} (${timezone})`;
}
