import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadEvents, saveEvents, STORAGE_KEYS } from '../lib/storage';
import type { EventDetails, OpResult, RecordEvent, RecordInput, SkydiverInput } from '../types';
import * as ops from './eventOps';
import { useOrganizer } from './OrganizerContext';

interface EventsContextValue {
  events: RecordEvent[];
  getEvent: (id: string) => RecordEvent | undefined;
  isOwner: (event: RecordEvent) => boolean;
  createEvent: (details: EventDetails) => OpResult;
  updateEvent: (id: string, details: EventDetails) => OpResult;
  deleteEvent: (id: string) => OpResult;
  addSkydiver: (eventId: string, input: SkydiverInput) => OpResult;
  updateSkydiver: (eventId: string, skydiverId: string, input: SkydiverInput) => OpResult;
  removeSkydiver: (eventId: string, skydiverId: string) => OpResult;
  addRecord: (eventId: string, input: RecordInput) => OpResult;
  updateRecord: (eventId: string, recordId: string, input: RecordInput) => OpResult;
  deleteRecord: (eventId: string, recordId: string) => OpResult;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const { current } = useOrganizer();
  const [events, setEvents] = useState<RecordEvent[]>(loadEvents);
  // Ref lets operations run synchronously against the latest list and return their result.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => saveEvents(events), [events]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.events) setEvents(loadEvents());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const actorId = current?.id ?? '';

  const apply = useCallback((run: (events: RecordEvent[]) => OpResult): OpResult => {
    const result = run(eventsRef.current);
    if (result.ok) {
      eventsRef.current = result.events;
      setEvents(result.events);
    }
    return result;
  }, []);

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      getEvent: (id) => events.find((e) => e.id === id),
      isOwner: (event) => Boolean(actorId) && event.createdBy === actorId,
      createEvent: (details) => apply((ev) => ops.createEvent(ev, details, actorId)),
      updateEvent: (id, details) => apply((ev) => ops.updateEvent(ev, id, details, actorId)),
      deleteEvent: (id) => apply((ev) => ops.deleteEvent(ev, id, actorId)),
      addSkydiver: (eventId, input) => apply((ev) => ops.addSkydiver(ev, eventId, input, actorId)),
      updateSkydiver: (eventId, skydiverId, input) =>
        apply((ev) => ops.updateSkydiver(ev, eventId, skydiverId, input, actorId)),
      removeSkydiver: (eventId, skydiverId) => apply((ev) => ops.removeSkydiver(ev, eventId, skydiverId, actorId)),
      addRecord: (eventId, input) => apply((ev) => ops.addRecord(ev, eventId, input, actorId)),
      updateRecord: (eventId, recordId, input) => apply((ev) => ops.updateRecord(ev, eventId, recordId, input, actorId)),
      deleteRecord: (eventId, recordId) => apply((ev) => ops.deleteRecord(ev, eventId, recordId, actorId)),
    }),
    [events, actorId, apply],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used inside EventsProvider');
  return ctx;
}
