import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

export function generateSlug(): string {
  return nanoid();
}

export function generateToken(): string {
  return customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32)();
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/** Format minutes-from-midnight to readable time (e.g. 510 -> "8:30 AM") */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function generateICS(
  eventName: string,
  description: string | null,
  slotStart: string,
  slotEnd: string
): string {
  const start = formatICSDate(new Date(slotStart));
  const end = formatICSDate(new Date(slotEnd));
  const now = formatICSDate(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GroupMeet//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${now}`,
    `SUMMARY:${eventName}`,
    description ? `DESCRIPTION:${description}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function downloadICS(
  eventName: string,
  description: string | null,
  slotStart: string,
  slotEnd: string
) {
  const ics = generateICS(eventName, description, slotStart, slotEnd);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName.replace(/\s+/g, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Returns time slots as minutes-from-midnight.
 * stepMinutes: 60 for hourly, 30 for half-hour.
 * timeStart/timeEnd are hours (e.g. 8, 22).
 */
export function getTimeSlots(timeStart: number, timeEnd: number, stepMinutes: number = 60): number[] {
  const slots: number[] = [];
  const startMins = timeStart * 60;
  const endMins = timeEnd * 60;
  for (let m = startMins; m < endMins; m += stepMinutes) {
    slots.push(m);
  }
  return slots;
}

/** Get step size in minutes for a granularity type */
export function granularityStepMinutes(granularity: string): number {
  if (granularity === 'half-hour') return 30;
  return 60; // 'hourly' default
}

/** Build a slot key from date and minutes-from-midnight */
export function slotKey(date: string, minutes?: number): string {
  if (minutes !== undefined) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return date;
}

/** Parse a slot key back into { date, minutes } */
export function parseSlotKey(key: string): { date: string; minutes: number } {
  const [date, time] = key.split('T');
  const [h, m] = time.split(':').map(Number);
  return { date, minutes: h * 60 + (m || 0) };
}

// ─── Timezone helpers ───

/** Get the user's local IANA timezone */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

/**
 * Convert a wall-clock date + minutes-from-midnight in a given timezone to a UTC ISO string.
 * e.g. wallClockToUTC("2026-03-05", 480, "America/New_York") → "2026-03-05T13:00:00.000Z"
 */
export function wallClockToUTC(date: string, minutes: number, timezone: string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Build an ISO-like string and use the timezone offset to convert
  const localStr = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

  // Use Intl to find the UTC offset for this timezone at this date/time
  const tempDate = new Date(localStr + 'Z'); // treat as UTC temporarily
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Binary-search style: find the UTC time that, when displayed in the target timezone, matches our wall clock
  // Simple approach: compute offset by comparing formatted output
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const tzH = parseInt(getPart('hour'));
  const tzM = parseInt(getPart('minute'));
  const tzDay = parseInt(getPart('day'));
  const tempDay = tempDate.getUTCDate();

  // Offset in minutes = (what timezone shows) - (what we put in as UTC)
  let offsetMinutes = (tzH * 60 + tzM) - (h * 60 + m);
  // Adjust for day boundary crossing
  if (tzDay > tempDay) offsetMinutes += 24 * 60;
  if (tzDay < tempDay) offsetMinutes -= 24 * 60;

  // The actual UTC time = wall clock time - offset
  const utcMs = new Date(localStr + 'Z').getTime() - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Convert a UTC ISO string to wall-clock { date, minutes } in a given timezone.
 * e.g. utcToWallClock("2026-03-05T13:00:00.000Z", "America/New_York") → { date: "2026-03-05", minutes: 480 }
 */
export function utcToWallClock(utcIso: string, timezone: string): { date: string; minutes: number } {
  const dt = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dt);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';

  const year = getPart('year');
  const month = getPart('month').padStart(2, '0');
  const day = getPart('day').padStart(2, '0');
  let hour = parseInt(getPart('hour'));
  if (hour === 24) hour = 0; // midnight edge case
  const minute = parseInt(getPart('minute'));

  return {
    date: `${year}-${month}-${day}`,
    minutes: hour * 60 + minute,
  };
}

/**
 * Format a UTC ISO string for display in a given timezone.
 */
export function formatUTCInTimezone(utcIso: string, timezone: string): string {
  const dt = new Date(utcIso);
  return dt.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Get abbreviated timezone name (e.g. "EST", "PST") */
export function getTimezoneAbbr(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || timezone;
  } catch {
    return timezone;
  }
}
