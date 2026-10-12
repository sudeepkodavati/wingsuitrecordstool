// Reads events saved in this browser before sign-in and Supabase existed, so they can be imported
// once. The app no longer writes events to localStorage.
import type { FormationGrid, RecordEntry, RecordEvent, Skydiver } from '../types';
import { splitFullName } from './names';
import { DEFAULT_VIEWPOINT, isViewpoint } from './viewpoint';

export const STORAGE_KEYS = {
  events: 'wsr:v1:events',
  /** Where imported events are kept afterwards, as a backup. */
  importedEvents: 'wsr:v1:events.imported',
  organizers: 'wsr:v1:organizers',
  currentOrganizer: 'wsr:v1:currentOrganizer',
} as const;

function read<T>(key: string, fallback: T, isValid: (v: unknown) => boolean): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

type LegacySkydiver = Skydiver & { fullName?: string };

/** Older skydivers may only have `fullName`, and may lack `isVideographer`. */
function migrateSkydiver(s: LegacySkydiver): Skydiver {
  const withFlag = { ...s, isVideographer: s.isVideographer === true };
  if (typeof s.lastName === 'string') return withFlag;
  const { fullName = '', ...rest } = withFlag;
  return { ...rest, ...splitFullName(fullName) };
}

/** Events saved in this browser before sign-in existed. Older ones may lack `records` (or a record viewpoint), or use single full names for skydivers. */
export const loadLegacyEvents = () =>
  read<RecordEvent[]>(STORAGE_KEYS.events, [], Array.isArray).map((e) => ({
    ...e,
    records: (e.records ?? []).map(({ grid, ...r }: RecordEntry & { grid?: FormationGrid }) => ({
      ...r,
      // Records saved before sequential points had a single `grid`.
      grids: Array.isArray(r.grids) && r.grids.length > 0 ? r.grids : grid ? [grid] : [],
      viewpoint: isViewpoint(r.viewpoint) ? r.viewpoint : DEFAULT_VIEWPOINT,
      attemptDate: typeof r.attemptDate === 'string' ? r.attemptDate : '',
    })),
    skydivers: (e.skydivers ?? []).map(migrateSkydiver),
  }));

/** After a successful import: keep the old data as a backup under another key and drop the local profiles. */
export function markLegacyEventsImported(): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.events);
    if (raw !== null) window.localStorage.setItem(STORAGE_KEYS.importedEvents, raw);
    window.localStorage.removeItem(STORAGE_KEYS.events);
    window.localStorage.removeItem(STORAGE_KEYS.organizers);
    window.localStorage.removeItem(STORAGE_KEYS.currentOrganizer);
  } catch {
    // Storage blocked; nothing to clean up.
  }
}
