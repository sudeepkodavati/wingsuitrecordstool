import { newId } from '../lib/ids';
import { toSharedEvent } from '../lib/share';
import * as ops from '../state/eventOps';
import type { OpResult, RecordEvent } from '../types';
import { StoreError, type EventStore } from './store';

/**
 * In-memory store built on the pure event operations. Used by the UI tests (and anywhere a real
 * backend isn't wanted). `actorId` plays the signed-in user; only they can change their events.
 */
export function createMemoryStore(actorId: string, initial: RecordEvent[] = []): EventStore & { snapshot(): RecordEvent[] } {
  let events = structuredClone(initial);

  const apply = (result: OpResult): string | undefined => {
    if (!result.ok) throw new StoreError(result.errors.form ?? 'Please fix the highlighted fields.', result.errors);
    events = result.events;
    return result.id;
  };
  const event = (id: string) => {
    const e = events.find((x) => x.id === id);
    if (!e) throw new StoreError('Event not found');
    return e;
  };
  const clone = <T,>(v: T): T => structuredClone(v);

  return {
    snapshot: () => clone(events),
    async loadEvents() {
      return clone(events);
    },
    async createEvent(details) {
      const id = apply(ops.createEvent(events, details, actorId))!;
      return clone(event(id));
    },
    async updateEvent(eventId, details) {
      apply(ops.updateEvent(events, eventId, details, actorId));
      return clone(event(eventId));
    },
    async deleteEvent(eventId) {
      apply(ops.deleteEvent(events, eventId, actorId));
    },
    async addSkydiver(eventId, input) {
      const id = apply(ops.addSkydiver(events, eventId, input, actorId))!;
      return clone(event(eventId).skydivers.find((s) => s.id === id)!);
    },
    async updateSkydiver(eventId, skydiverId, input) {
      apply(ops.updateSkydiver(events, eventId, skydiverId, input, actorId));
      return clone(event(eventId).skydivers.find((s) => s.id === skydiverId)!);
    },
    async removeSkydiver(eventId, skydiverId) {
      apply(ops.removeSkydiver(events, eventId, skydiverId, actorId));
      return clone(event(eventId).records);
    },
    async addRecord(eventId, input) {
      const id = apply(ops.addRecord(events, eventId, input, actorId))!;
      return clone(event(eventId).records.find((r) => r.id === id)!);
    },
    async updateRecord(eventId, recordId, input) {
      apply(ops.updateRecord(events, eventId, recordId, input, actorId));
      return clone(event(eventId).records.find((r) => r.id === recordId)!);
    },
    async deleteRecord(eventId, recordId) {
      apply(ops.deleteRecord(events, eventId, recordId, actorId));
    },
    async importEvents(incoming) {
      let imported = 0;
      let skipped = 0;
      for (const e of incoming) {
        if (events.some((x) => x.id === e.id)) {
          skipped++;
          continue;
        }
        events = [...events, { ...clone(e), createdBy: actorId }];
        imported++;
      }
      return { imported, skipped };
    },
    async setEventSharing(eventId, enabled) {
      const e = event(eventId);
      if (e.createdBy !== actorId) throw new StoreError('Only the organizer who created this event can share it');
      const token = enabled ? newId() : null;
      events = events.map((x) => (x.id === eventId ? { ...x, shareToken: token } : x));
      return token;
    },
    async getSharedEvent(token) {
      const e = events.find((x) => x.shareToken && x.shareToken === token);
      return e ? toSharedEvent(clone(e)) : null;
    },
  };
}
