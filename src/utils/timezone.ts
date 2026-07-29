export const APP_TIME_ZONE = 'Asia/Bangkok';
export const APP_UTC_OFFSET = '+07:00';

type DateInput = Date | string | number | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const EXPLICIT_TIME_ZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parses values from Thai-local date/time controls as Asia/Bangkok while
 * preserving timestamps that already include Z or an explicit UTC offset.
 */
export function parseBangkokDateTime(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    const copy = new Date(input.getTime());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }
  if (typeof input === 'number') {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const value = input.trim();
  let normalized = value;
  if (DATE_ONLY_PATTERN.test(value)) {
    normalized = `${value}T00:00:00${APP_UTC_OFFSET}`;
  } else if (
    LOCAL_DATE_TIME_PATTERN.test(value) &&
    !EXPLICIT_TIME_ZONE_PATTERN.test(value)
  ) {
    normalized = `${value}${APP_UTC_OFFSET}`;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toBangkokISOString(input: DateInput): string | null {
  return parseBangkokDateTime(input)?.toISOString() ?? null;
}

export function formatThaiDateTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseBangkokDateTime(input);
  if (!date) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatThaiDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseBangkokDateTime(input);
  if (!date) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}

/** Converts an instant to the value expected by an HTML datetime-local input. */
export function formatBangkokDateTimeInput(input: DateInput): string {
  const date = parseBangkokDateTime(input);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

