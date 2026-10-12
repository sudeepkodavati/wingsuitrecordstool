import type { RecordEvent, Skydiver } from '../types';

export type MembershipStatus = 'current' | 'expires-during-event' | 'expired';

/**
 * Membership is valid through its expiration date (inclusive).
 * - expired: lapses before the event starts
 * - expires-during-event: valid on day one but lapses before the last day
 */
export function membershipStatus(expiration: string, event: Pick<RecordEvent, 'startDate' | 'endDate'>): MembershipStatus {
  const end = event.endDate || event.startDate;
  if (expiration < event.startDate) return 'expired';
  if (expiration < end) return 'expires-during-event';
  return 'current';
}

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** By first name, then last name, then jumper number. */
export function sortByName<T extends Pick<Skydiver, 'firstName' | 'lastName' | 'jumperNumber'>>(skydivers: T[]): T[] {
  return [...skydivers].sort(
    (a, b) => cmp(a.firstName, b.firstName) || cmp(a.lastName, b.lastName) || a.jumperNumber - b.jumperNumber,
  );
}
