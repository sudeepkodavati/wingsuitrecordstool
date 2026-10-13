import type { SharedEvent } from '../lib/share';
import type { EventDetails, FieldErrors, RecordEntry, RecordEvent, RecordInput, Skydiver, SkydiverInput } from '../types';

/** A failed store call. `fieldErrors` maps onto form fields (e.g. a duplicate USPA ID). */
export class StoreError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Where events live. Inputs are already normalized and validated by EventsContext; the store
 * persists them and returns what was saved (including server-assigned values such as ids and
 * jumper numbers). Permission checks happen in the store's backend (row level security).
 */
export interface EventStore {
  loadEvents(): Promise<RecordEvent[]>;
  createEvent(details: EventDetails): Promise<RecordEvent>;
  updateEvent(eventId: string, details: EventDetails): Promise<RecordEvent>;
  deleteEvent(eventId: string): Promise<void>;
  addSkydiver(eventId: string, input: SkydiverInput): Promise<Skydiver>;
  updateSkydiver(eventId: string, skydiverId: string, input: SkydiverInput): Promise<Skydiver>;
  /** Returns the event's records afterwards (the skydiver is removed from them too). */
  removeSkydiver(eventId: string, skydiverId: string): Promise<RecordEntry[]>;
  addRecord(eventId: string, input: RecordInput): Promise<RecordEntry>;
  updateRecord(eventId: string, recordId: string, input: RecordInput): Promise<RecordEntry>;
  deleteRecord(eventId: string, recordId: string): Promise<void>;
  /** One-time import of events saved in this browser before sign-in existed. */
  importEvents(events: RecordEvent[]): Promise<ImportResult>;
  /** Turns the participant share link on (always a fresh token) or off. Returns the token or null. */
  setEventSharing(eventId: string, enabled: boolean): Promise<string | null>;
  /** The participant view for a share token, or null if it isn't valid. Works without signing in. */
  getSharedEvent(token: string): Promise<SharedEvent | null>;
}
