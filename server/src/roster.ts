import type { SkydiverPayload } from './schema';

export type MembershipStatus = 'current' | 'expires-during-event' | 'expired';

/** Mirrors client/src/lib/membership.ts — membership is valid through its expiration date. */
export function membershipStatus(expiration: string, startDate: string, endDate: string): MembershipStatus {
  const end = endDate || startDate;
  if (expiration < startDate) return 'expired';
  if (expiration < end) return 'expires-during-event';
  return 'current';
}

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Mirrors client/src/lib/membership.ts — first name, then last name, then jumper number. */
export function sortByName<T extends Pick<SkydiverPayload, 'firstName' | 'lastName' | 'jumperNumber'>>(skydivers: T[]): T[] {
  return [...skydivers].sort(
    (a, b) => cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName) || a.jumperNumber - b.jumperNumber,
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function formatDateRange(start: string, end: string): string {
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}
