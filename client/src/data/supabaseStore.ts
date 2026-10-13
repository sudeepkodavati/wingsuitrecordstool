import type { PostgrestError } from '@supabase/supabase-js';
import { newId } from '../lib/ids';
import { getSupabase } from '../lib/supabase';
import type { SharedEvent } from '../lib/share';
import type { EventDetails, RecordEntry, RecordEvent, RecordInput, Skydiver, SkydiverInput } from '../types';
import { StoreError, type EventStore, type ImportResult } from './store';

// ---- Row shapes (snake_case columns) and mapping to the app's types ----

const EVENT_COLUMNS =
  'id, created_by, name, drop_zone, city, state, start_date, end_date, aircraft, organizer, local_judge, remote_judges, notes, next_jumper_number, share_token, created_at, updated_at';
const SKYDIVER_COLUMNS =
  'id, event_id, jumper_number, first_name, last_name, nick_name, uspa_membership_id, membership_expiration, uspa_license_number, is_videographer, added_at';
const RECORD_COLUMNS =
  'id, event_id, zone, state, type, attempt_date, viewpoint, skydiver_ids, grids, created_at, updated_at';

type EventRow = {
  id: string;
  created_by: string;
  name: string;
  drop_zone: string;
  city: string;
  state: string;
  start_date: string;
  end_date: string;
  aircraft: string;
  organizer: Partial<RecordEvent['organizer']>;
  local_judge: Partial<RecordEvent['localJudge']>;
  remote_judges: RecordEvent['remoteJudges'];
  notes: string;
  next_jumper_number: number;
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

type SkydiverRow = {
  id: string;
  event_id: string;
  jumper_number: number;
  first_name: string;
  last_name: string;
  nick_name: string;
  uspa_membership_id: string;
  membership_expiration: string;
  uspa_license_number: string;
  is_videographer: boolean;
  added_at: string;
};

type RecordRow = {
  id: string;
  event_id: string;
  zone: RecordEntry['zone'];
  state: string;
  type: RecordEntry['type'];
  attempt_date: string | null;
  viewpoint: RecordEntry['viewpoint'];
  skydiver_ids: string[];
  grids: RecordEntry['grids'];
  created_at: string;
  updated_at: string;
};

const toEvent = (r: EventRow): RecordEvent => ({
  id: r.id,
  createdBy: r.created_by,
  name: r.name,
  dropZone: r.drop_zone,
  city: r.city,
  state: r.state,
  startDate: r.start_date,
  endDate: r.end_date,
  aircraft: r.aircraft,
  organizer: { name: '', phone: '', email: '', ...r.organizer },
  localJudge: { name: '', phone: '', email: '', role: '', ...r.local_judge },
  remoteJudges: r.remote_judges ?? [],
  notes: r.notes,
  nextJumperNumber: r.next_jumper_number,
  shareToken: r.share_token,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  skydivers: [],
  records: [],
});

const toSkydiver = (r: SkydiverRow): Skydiver => ({
  id: r.id,
  jumperNumber: r.jumper_number,
  firstName: r.first_name,
  lastName: r.last_name,
  nickName: r.nick_name,
  uspaMembershipId: r.uspa_membership_id,
  membershipExpiration: r.membership_expiration,
  uspaLicenseNumber: r.uspa_license_number,
  isVideographer: r.is_videographer,
  addedAt: r.added_at,
});

const toRecord = (r: RecordRow): RecordEntry => ({
  id: r.id,
  zone: r.zone,
  state: r.state,
  type: r.type,
  attemptDate: r.attempt_date ?? '',
  viewpoint: r.viewpoint,
  skydiverIds: r.skydiver_ids ?? [],
  grids: r.grids ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const eventFields = (d: EventDetails) => ({
  name: d.name,
  drop_zone: d.dropZone,
  city: d.city,
  state: d.state,
  start_date: d.startDate,
  end_date: d.endDate,
  aircraft: d.aircraft,
  organizer: d.organizer,
  local_judge: d.localJudge,
  remote_judges: d.remoteJudges,
  notes: d.notes,
});

const skydiverFields = (s: SkydiverInput) => ({
  first_name: s.firstName,
  last_name: s.lastName,
  nick_name: s.nickName,
  uspa_membership_id: s.uspaMembershipId,
  membership_expiration: s.membershipExpiration,
  uspa_license_number: s.uspaLicenseNumber,
  is_videographer: s.isVideographer,
});

const recordFields = (r: RecordInput) => ({
  zone: r.zone,
  state: r.state,
  type: r.type,
  attempt_date: r.attemptDate || null,
  viewpoint: r.viewpoint,
  skydiver_ids: r.skydiverIds,
  grids: r.grids,
});

// ---- Errors ----

/** Turns a PostgREST/Postgres error into a message (and form field errors where it maps to one). */
export function toStoreError(error: PostgrestError | null, fallback = 'Something went wrong. Please try again.'): StoreError {
  if (!error) return new StoreError(fallback);
  const text = `${error.message} ${error.details ?? ''}`;
  if (error.code === '23505' && text.includes('uspa_membership_id')) {
    return new StoreError('Duplicate USPA membership ID', { uspaMembershipId: 'Already in this event' });
  }
  if (error.code === '42501' || error.code === 'PGRST116') {
    return new StoreError("You don't have permission to change this, or it no longer exists.");
  }
  if (error.code === '23514') return new StoreError('Some values were rejected by the database. Check the form and try again.');
  return new StoreError(fallback);
}

function must<T>({ data, error }: { data: T | null; error: PostgrestError | null }): T {
  if (error || data === null) throw toStoreError(error);
  return data;
}

// ---- Import ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Old local data may contain non-UUID ids (from a fallback id generator). The database needs
 * UUIDs, so replace those, consistently across record skydiver lists and grid positions.
 */
export function withUuids(e: RecordEvent): RecordEvent {
  const fix = new Map<string, string>();
  const id = (old: string) => {
    if (UUID.test(old)) return old;
    if (!fix.has(old)) fix.set(old, newId());
    return fix.get(old)!;
  };
  return {
    ...e,
    id: id(e.id),
    skydivers: e.skydivers.map((s) => ({ ...s, id: id(s.id) })),
    records: e.records.map((r) => ({
      ...r,
      id: id(r.id),
      skydiverIds: r.skydiverIds.map(id),
      grids: r.grids.map((g) => ({
        ...g,
        positions: Object.fromEntries(Object.entries(g.positions).map(([sid, p]) => [id(sid), p])),
      })),
    })),
  };
}

// ---- Store ----

export function createSupabaseStore(): EventStore {
  const db = () => getSupabase();

  return {
    async loadEvents() {
      const [events, skydivers, records] = await Promise.all([
        db().from('events').select(EVENT_COLUMNS).order('start_date', { ascending: false }),
        db().from('skydivers').select(SKYDIVER_COLUMNS).order('jumper_number'),
        db().from('records').select(RECORD_COLUMNS).order('created_at'),
      ]);
      const byId = new Map(must<EventRow[]>(events).map((r) => [r.id, toEvent(r)]));
      for (const s of must<SkydiverRow[]>(skydivers)) byId.get(s.event_id)?.skydivers.push(toSkydiver(s));
      for (const r of must<RecordRow[]>(records)) byId.get(r.event_id)?.records.push(toRecord(r));
      return [...byId.values()];
    },

    async createEvent(details) {
      return toEvent(must(await db().from('events').insert(eventFields(details)).select(EVENT_COLUMNS).single<EventRow>()));
    },

    async updateEvent(eventId, details) {
      return toEvent(
        must(await db().from('events').update(eventFields(details)).eq('id', eventId).select(EVENT_COLUMNS).single<EventRow>()),
      );
    },

    async deleteEvent(eventId) {
      const rows = must(await db().from('events').delete().eq('id', eventId).select('id'));
      if (rows.length === 0) throw toStoreError(null, "You don't have permission to delete this event.");
    },

    async addSkydiver(eventId, input) {
      const row = { event_id: eventId, ...skydiverFields(input) };
      return toSkydiver(must(await db().from('skydivers').insert(row).select(SKYDIVER_COLUMNS).single<SkydiverRow>()));
    },

    async updateSkydiver(eventId, skydiverId, input) {
      return toSkydiver(
        must(
          await db()
            .from('skydivers')
            .update(skydiverFields(input))
            .eq('id', skydiverId)
            .eq('event_id', eventId)
            .select(SKYDIVER_COLUMNS)
            .single<SkydiverRow>(),
        ),
      );
    },

    async removeSkydiver(eventId, skydiverId) {
      const rows = must(await db().from('skydivers').delete().eq('id', skydiverId).eq('event_id', eventId).select('id'));
      if (rows.length === 0) throw toStoreError(null, "You don't have permission to remove this skydiver.");
      // The database also took them off this event's records; return the updated records.
      const records = must<RecordRow[]>(await db().from('records').select(RECORD_COLUMNS).eq('event_id', eventId).order('created_at'));
      return records.map(toRecord);
    },

    async addRecord(eventId, input) {
      const row = { event_id: eventId, ...recordFields(input) };
      return toRecord(must(await db().from('records').insert(row).select(RECORD_COLUMNS).single<RecordRow>()));
    },

    async updateRecord(eventId, recordId, input) {
      return toRecord(
        must(
          await db()
            .from('records')
            .update(recordFields(input))
            .eq('id', recordId)
            .eq('event_id', eventId)
            .select(RECORD_COLUMNS)
            .single<RecordRow>(),
        ),
      );
    },

    async deleteRecord(eventId, recordId) {
      const rows = must(await db().from('records').delete().eq('id', recordId).eq('event_id', eventId).select('id'));
      if (rows.length === 0) throw toStoreError(null, "You don't have permission to delete this record.");
    },

    async importEvents(events) {
      const result: ImportResult = { imported: 0, skipped: 0 };
      for (const e of events.map(withUuids)) {
        // Keep ids so record skydiver lists and grid positions still line up.
        const { error } = await db().from('events').insert({ id: e.id, ...eventFields(e) });
        if (error) {
          if (error.code === '23505') {
            result.skipped++; // already imported
            continue;
          }
          throw toStoreError(error, `Could not import "${e.name}".`);
        }
        if (e.skydivers.length) {
          const rows = e.skydivers.map((s) => ({ id: s.id, event_id: e.id, jumper_number: s.jumperNumber, ...skydiverFields(s) }));
          const { error: sErr } = await db().from('skydivers').insert(rows);
          if (sErr) throw toStoreError(sErr, `Could not import the skydivers of "${e.name}".`);
        }
        if (e.records.length) {
          const rows = e.records.map((r) => ({ id: r.id, event_id: e.id, ...recordFields(r) }));
          const { error: rErr } = await db().from('records').insert(rows);
          if (rErr) throw toStoreError(rErr, `Could not import the records of "${e.name}".`);
        }
        result.imported++;
      }
      return result;
    },

    async setEventSharing(eventId, enabled) {
      const { data, error } = await db().rpc('set_event_sharing', { p_event_id: eventId, p_enabled: enabled });
      if (error) throw toStoreError(error, 'Could not change sharing for this event.');
      return (data as string | null) ?? null;
    },

    async getSharedEvent(token) {
      const { data, error } = await db().rpc('get_shared_event', { p_token: token });
      if (error) throw toStoreError(error, 'Could not load this shared event.');
      return (data as SharedEvent | null) ?? null;
    },
  };
}
