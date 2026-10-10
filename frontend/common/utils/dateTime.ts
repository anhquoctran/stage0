import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import type { DateInput } from '../types/DateInput';

dayjs.extend(utc);

function validDate(value: DateInput) {
  if (value === null || value === undefined || value === '') return null;
  const date = dayjs(value);
  return date.isValid() ? date : null;
}

/** Numeric inputs are Unix milliseconds; use the Unix-second helpers for Git timestamps. */
export function formatTime(value: DateInput, withSeconds = false): string {
  const date = validDate(value);
  return date?.format(withSeconds ? 'HH:mm:ss' : 'HH:mm') ?? '';
}

export function formatDate(value: DateInput): string {
  return validDate(value)?.format('MMM D, YYYY') ?? '';
}

export function formatDateTime(value: DateInput): string {
  return validDate(value)?.format('MMM D, YYYY HH:mm') ?? '';
}

/** Compact relative time for narrow Git/MR UI, with future dates clamped to now. */
export function formatRelativeTime(value: DateInput): string {
  const date = validDate(value);
  if (!date) return '';
  const seconds = Math.max(0, dayjs().diff(date, 'second'));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 30 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 365 * 86400) return `${Math.floor(seconds / (30 * 86400))}mo ago`;
  return `${Math.floor(seconds / (365 * 86400))}y ago`;
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
  return `${localAtCommit.format('MMM D, YYYY HH:mm')} (${timezone})`;
}
