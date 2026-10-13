import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StoreError, type EventStore, type ImportResult } from '../data/store';
import type { SharedEvent } from '../lib/share';
import {
  normalizeEventDetails,
  normalizeRecord,
  normalizeSkydiver,
  validateEventDetails,
  validateRecord,
  validateSkydiver,
} from '../lib/validation';
import type { EventDetails, FieldErrors, RecordEntry, RecordEvent, RecordInput, SkydiverInput } from '../types';
import { useAuth } from './AuthContext';

export type ActionResult = { ok: true; id?: string } | { ok: false; errors: FieldErrors };

interface EventsContextValue {
  status: 'loading' | 'ready' | 'error';
  loadError: string;
  events: RecordEvent[];
  /** `quiet` refreshes in the background without the full-page loading state. */
  reload: (options?: { quiet?: boolean }) => Promise<void>;
  getEvent: (id: string) => RecordEvent | undefined;
  /** Can the signed-in user change this event? Admins: always. Organizers: events they created. */
  isOwner: (event: RecordEvent) => boolean;
  /** Did the signed-in user create this event? */
  isMine: (event: RecordEvent) => boolean;
  createEvent: (details: EventDetails) => Promise<ActionResult>;
  updateEvent: (id: string, details: EventDetails) => Promise<ActionResult>;
  deleteEvent: (id: string) => Promise<ActionResult>;
  addSkydiver: (eventId: string, input: SkydiverInput) => Promise<ActionResult>;
  updateSkydiver: (eventId: string, skydiverId: string, input: SkydiverInput) => Promise<ActionResult>;
  removeSkydiver: (eventId: string, skydiverId: string) => Promise<ActionResult>;
  addRecord: (eventId: string, input: RecordInput) => Promise<ActionResult>;
  updateRecord: (eventId: string, recordId: string, input: RecordInput) => Promise<ActionResult>;
  deleteRecord: (eventId: string, recordId: string) => Promise<ActionResult>;
  importEvents: (events: RecordEvent[]) => Promise<ImportResult>;
  /** Turn the participant link on (fresh token, returned as `id`) or off. */
  setSharing: (eventId: string, enabled: boolean) => Promise<ActionResult>;
  /** Public: the participant view for a share token (null if invalid). */
  loadSharedEvent: (token: string) => Promise<SharedEvent | null>;
}

const EventsContext = createContext<EventsContextValue | null>(null);

const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;

function failure(err: unknown): ActionResult {
  if (err instanceof StoreError) {
    return { ok: false, errors: hasErrors(err.fieldErrors) ? err.fieldErrors : { form: err.message } };
  }
  return { ok: false, errors: { form: 'Something went wrong. Please check your connection and try again.' } };
}

export function EventsProvider({ store, children }: { store: EventStore; children: ReactNode }) {
  const { status: authStatus, userId, role } = useAuth();
  const [events, setEvents] = useState<RecordEvent[]>([]);
  const [status, setStatus] = useState<EventsContextValue['status']>('loading');
  const [loadError, setLoadError] = useState('');
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const reload = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      setEvents(await store.loadEvents());
      setStatus('ready');
    } catch (err) {
      setLoadError(err instanceof StoreError ? err.message : 'Could not load events. Please check your connection.');
      setStatus('error');
    }
  }, [store]);

  useEffect(() => {
    if (authStatus === 'signed-in') reload();
    else setEvents([]);
  }, [authStatus, userId, reload]);

  const patchEvent = (eventId: string, fn: (e: RecordEvent) => RecordEvent) =>
    setEvents((list) => list.map((e) => (e.id === eventId ? fn(e) : e)));
  const current = (eventId: string) => eventsRef.current.find((e) => e.id === eventId);

  const value = useMemo<EventsContextValue>(() => {
    const attempt = async (run: () => Promise<string | void>): Promise<ActionResult> => {
      try {
        const id = await run();
        return { ok: true, id: id || undefined };
      } catch (err) {
        return failure(err);
      }
    };

    return {
      status,
      loadError,
      events,
      reload,
      getEvent: (id) => events.find((e) => e.id === id),
      isOwner: (event) => role === 'admin' || (Boolean(userId) && event.createdBy === userId),
      isMine: (event) => Boolean(userId) && event.createdBy === userId,

      createEvent: async (details) => {
        const clean = normalizeEventDetails(details);
        const errors = validateEventDetails(clean);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const created = await store.createEvent(clean);
          setEvents((list) => [...list, created]);
          return created.id;
        });
      },

      updateEvent: async (id, details) => {
        const clean = normalizeEventDetails(details);
        const errors = validateEventDetails(clean);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const saved = await store.updateEvent(id, clean);
          patchEvent(id, (e) => ({ ...e, ...saved, skydivers: e.skydivers, records: e.records }));
        });
      },

      deleteEvent: (id) =>
        attempt(async () => {
          await store.deleteEvent(id);
          setEvents((list) => list.filter((e) => e.id !== id));
        }),

      addSkydiver: async (eventId, input) => {
        const event = current(eventId);
        if (!event) return { ok: false, errors: { form: 'Event not found' } };
        const clean = normalizeSkydiver(input);
        const errors = validateSkydiver(clean, event);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const saved = await store.addSkydiver(eventId, clean);
          patchEvent(eventId, (e) => ({
            ...e,
            skydivers: [...e.skydivers, saved],
            nextJumperNumber: Math.max(e.nextJumperNumber, saved.jumperNumber + 1),
          }));
          return saved.id;
        });
      },

      updateSkydiver: async (eventId, skydiverId, input) => {
        const event = current(eventId);
        if (!event) return { ok: false, errors: { form: 'Event not found' } };
        const clean = normalizeSkydiver(input);
        const errors = validateSkydiver(clean, event, skydiverId);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const saved = await store.updateSkydiver(eventId, skydiverId, clean);
          patchEvent(eventId, (e) => ({ ...e, skydivers: e.skydivers.map((s) => (s.id === skydiverId ? saved : s)) }));
        });
      },

      removeSkydiver: (eventId, skydiverId) =>
        attempt(async () => {
          const records: RecordEntry[] = await store.removeSkydiver(eventId, skydiverId);
          patchEvent(eventId, (e) => ({ ...e, skydivers: e.skydivers.filter((s) => s.id !== skydiverId), records }));
        }),

      addRecord: async (eventId, input) => {
        const event = current(eventId);
        if (!event) return { ok: false, errors: { form: 'Event not found' } };
        const clean = normalizeRecord(input, event);
        const errors = validateRecord(clean, event);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const saved = await store.addRecord(eventId, clean);
          patchEvent(eventId, (e) => ({ ...e, records: [...e.records, saved] }));
          return saved.id;
        });
      },

      updateRecord: async (eventId, recordId, input) => {
        const event = current(eventId);
        if (!event) return { ok: false, errors: { form: 'Event not found' } };
        const clean = normalizeRecord(input, event);
        const errors = validateRecord(clean, event);
        if (hasErrors(errors)) return { ok: false, errors };
        return attempt(async () => {
          const saved = await store.updateRecord(eventId, recordId, clean);
          patchEvent(eventId, (e) => ({ ...e, records: e.records.map((r) => (r.id === recordId ? saved : r)) }));
        });
      },

      deleteRecord: (eventId, recordId) =>
        attempt(async () => {
          await store.deleteRecord(eventId, recordId);
          patchEvent(eventId, (e) => ({ ...e, records: e.records.filter((r) => r.id !== recordId) }));
        }),

      setSharing: (eventId, enabled) =>
        attempt(async () => {
          const token = await store.setEventSharing(eventId, enabled);
          patchEvent(eventId, (e) => ({ ...e, shareToken: token }));
          return token ?? undefined;
        }),

      loadSharedEvent: (token) => store.getSharedEvent(token),

      importEvents: async (incoming) => {
        const result = await store.importEvents(incoming);
        await reload({ quiet: true });
        return result;
      },
    };
  }, [events, status, loadError, reload, store, role, userId]);

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used inside EventsProvider');
  return ctx;
}
