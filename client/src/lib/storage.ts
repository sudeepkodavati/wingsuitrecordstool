import type { FormationGrid, OrganizerProfile, RecordEntry, RecordEvent, Skydiver } from '../types';
import { splitFullName } from './names';
import { DEFAULT_VIEWPOINT, isViewpoint } from './viewpoint';

export const STORAGE_KEYS = {
  events: 'wsr:v1:events',
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

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the app keeps working in memory.
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

// Older events may lack `records` (or a record viewpoint), or use single full names for skydivers.
export const loadEvents = () =>
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
export const saveEvents = (events: RecordEvent[]) => write(STORAGE_KEYS.events, events);

export const loadOrganizers = () => read<OrganizerProfile[]>(STORAGE_KEYS.organizers, [], Array.isArray);
export const saveOrganizers = (profiles: OrganizerProfile[]) => write(STORAGE_KEYS.organizers, profiles);

export const loadCurrentOrganizerId = () =>
  read<string | null>(STORAGE_KEYS.currentOrganizer, null, (v) => typeof v === 'string');
export const saveCurrentOrganizerId = (id: string) => write(STORAGE_KEYS.currentOrganizer, id);
