import { newId } from '../lib/ids';
import {
  normalizeEventDetails,
  normalizeRecord,
  normalizeSkydiver,
  validateEventDetails,
  validateRecord,
  validateSkydiver,
} from '../lib/validation';
import type { EventDetails, OpResult, RecordEntry, RecordEvent, RecordInput, SkydiverInput } from '../types';

/*
 * Pure operations on the event list. Each checks ownership and validates input,
 * returning either the next list or field errors — nothing is mutated.
 */

const NOT_FOUND: OpResult = { ok: false, errors: { form: 'Event not found' } };
const NOT_OWNER: OpResult = { ok: false, errors: { form: 'Only the organizer who created this event can change it' } };

const hasErrors = (e: object) => Object.keys(e).length > 0;
const now = () => new Date().toISOString();

function withOwnedEvent(
  events: RecordEvent[],
  eventId: string,
  actorId: string,
  fn: (event: RecordEvent) => OpResult | RecordEvent,
): OpResult {
  const event = events.find((e) => e.id === eventId);
  if (!event) return NOT_FOUND;
  if (event.createdBy !== actorId) return NOT_OWNER;
  const result = fn(event);
  if ('ok' in result) return result;
  return { ok: true, events: events.map((e) => (e.id === eventId ? result : e)) };
}

export function createEvent(events: RecordEvent[], details: EventDetails, actorId: string): OpResult {
  const clean = normalizeEventDetails(details);
  const errors = validateEventDetails(clean);
  if (hasErrors(errors)) return { ok: false, errors };
  const ts = now();
  const event: RecordEvent = {
    ...clean,
    id: newId(),
    createdBy: actorId,
    createdAt: ts,
    updatedAt: ts,
    nextJumperNumber: 1,
    skydivers: [],
    records: [],
  };
  return { ok: true, events: [...events, event], id: event.id };
}

export function updateEvent(events: RecordEvent[], eventId: string, details: EventDetails, actorId: string): OpResult {
  return withOwnedEvent(events, eventId, actorId, (event) => {
    const clean = normalizeEventDetails(details);
    const errors = validateEventDetails(clean);
    if (hasErrors(errors)) return { ok: false, errors };
    return { ...event, ...clean, updatedAt: now() };
  });
}

export function deleteEvent(events: RecordEvent[], eventId: string, actorId: string): OpResult {
  const event = events.find((e) => e.id === eventId);
  if (!event) return NOT_FOUND;
  if (event.createdBy !== actorId) return NOT_OWNER;
  return { ok: true, events: events.filter((e) => e.id !== eventId) };
}

export function addSkydiver(events: RecordEvent[], eventId: string, input: SkydiverInput, actorId: string): OpResult {
  let addedId: string | undefined;
  const result = withOwnedEvent(events, eventId, actorId, (event) => {
    const clean = normalizeSkydiver(input);
    const errors = validateSkydiver(clean, event);
    if (hasErrors(errors)) return { ok: false, errors };
    addedId = newId();
    return {
      ...event,
      skydivers: [...event.skydivers, { ...clean, id: addedId, jumperNumber: event.nextJumperNumber, addedAt: now() }],
      nextJumperNumber: event.nextJumperNumber + 1,
      updatedAt: now(),
    };
  });
  return result.ok ? { ...result, id: addedId } : result;
}

export function updateSkydiver(
  events: RecordEvent[],
  eventId: string,
  skydiverId: string,
  input: SkydiverInput,
  actorId: string,
): OpResult {
  return withOwnedEvent(events, eventId, actorId, (event) => {
    if (!event.skydivers.some((s) => s.id === skydiverId)) return { ok: false, errors: { form: 'Skydiver not found' } };
    const clean = normalizeSkydiver(input);
    const errors = validateSkydiver(clean, event, skydiverId);
    if (hasErrors(errors)) return { ok: false, errors };
    return {
      ...event,
      skydivers: event.skydivers.map((s) => (s.id === skydiverId ? { ...s, ...clean } : s)),
      updatedAt: now(),
    };
  });
}

/**
 * The removed skydiver's jumper number is retired — nextJumperNumber is left untouched.
 * They are also taken off every record in the event.
 */
export function removeSkydiver(events: RecordEvent[], eventId: string, skydiverId: string, actorId: string): OpResult {
  return withOwnedEvent(events, eventId, actorId, (event) => ({
    ...event,
    skydivers: event.skydivers.filter((s) => s.id !== skydiverId),
    records: event.records.map((r) =>
      r.skydiverIds.includes(skydiverId) ? withoutSkydiver(r, skydiverId) : r,
    ),
    updatedAt: now(),
  }));
}

function withoutSkydiver(r: RecordEntry, skydiverId: string): RecordEntry {
  const grids = r.grids.map((g) => {
    const positions = { ...g.positions };
    delete positions[skydiverId];
    return { ...g, positions };
  });
  return { ...r, skydiverIds: r.skydiverIds.filter((id) => id !== skydiverId), grids };
}

export function addRecord(events: RecordEvent[], eventId: string, input: RecordInput, actorId: string): OpResult {
  let addedId: string | undefined;
  const result = withOwnedEvent(events, eventId, actorId, (event) => {
    const clean = normalizeRecord(input, event);
    const errors = validateRecord(clean, event);
    if (hasErrors(errors)) return { ok: false, errors };
    const ts = now();
    addedId = newId();
    return { ...event, records: [...event.records, { ...clean, id: addedId, createdAt: ts, updatedAt: ts }], updatedAt: ts };
  });
  return result.ok ? { ...result, id: addedId } : result;
}

export function updateRecord(
  events: RecordEvent[],
  eventId: string,
  recordId: string,
  input: RecordInput,
  actorId: string,
): OpResult {
  return withOwnedEvent(events, eventId, actorId, (event) => {
    if (!event.records.some((r) => r.id === recordId)) return { ok: false, errors: { form: 'Record not found' } };
    const clean = normalizeRecord(input, event);
    const errors = validateRecord(clean, event);
    if (hasErrors(errors)) return { ok: false, errors };
    const ts = now();
    return {
      ...event,
      records: event.records.map((r) => (r.id === recordId ? { ...r, ...clean, updatedAt: ts } : r)),
      updatedAt: ts,
    };
  });
}

export function deleteRecord(events: RecordEvent[], eventId: string, recordId: string, actorId: string): OpResult {
  return withOwnedEvent(events, eventId, actorId, (event) => ({
    ...event,
    records: event.records.filter((r) => r.id !== recordId),
    updatedAt: now(),
  }));
}
