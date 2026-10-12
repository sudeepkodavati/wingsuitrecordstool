import type { Skydiver } from '../types';

type Named = Pick<Skydiver, 'firstName' | 'lastName'>;

/** "Alex Aero" — for sentences and titles. */
export const displayName = (s: Named) => `${s.firstName} ${s.lastName}`.trim();

/** "Aero, Alex" — for lists sorted by last name. */
export const listName = (s: Named) => (s.firstName ? `${s.lastName}, ${s.firstName}` : s.lastName);

/** Splits a legacy single full name: the last word is the last name, the rest the first name. */
export function splitFullName(full: string): Named {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: '', lastName: parts[0] ?? '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}
