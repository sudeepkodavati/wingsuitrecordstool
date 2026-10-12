import { describe, expect, it } from 'vitest';
import { eventDetails, skydiverInput } from '../test/fixtures';
import type { OpResult, RecordEvent } from '../types';
import * as ops from './eventOps';

const OWNER = 'owner-1';
const OTHER = 'someone-else';

function unwrap(r: OpResult): RecordEvent[] {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.events;
}

function setup() {
  const r = ops.createEvent([], eventDetails(), OWNER);
  if (!r.ok || !r.id) throw new Error('create failed');
  return { events: r.events, eventId: r.id };
}

describe('events', () => {
  it('records the creator and starts jumper numbers at 1', () => {
    const { events } = setup();
    expect(events[0]).toMatchObject({ createdBy: OWNER, nextJumperNumber: 1, skydivers: [] });
  });

  it('only the creator can update or delete', () => {
    const { events, eventId } = setup();
    expect(ops.updateEvent(events, eventId, eventDetails({ name: 'Hijacked' }), OTHER).ok).toBe(false);
    expect(ops.deleteEvent(events, eventId, OTHER).ok).toBe(false);

    const updated = unwrap(ops.updateEvent(events, eventId, eventDetails({ name: 'Renamed' }), OWNER));
    expect(updated[0].name).toBe('Renamed');
    expect(unwrap(ops.deleteEvent(updated, eventId, OWNER))).toHaveLength(0);
  });

  it('returns validation errors without changing state', () => {
    const { events, eventId } = setup();
    const r = ops.updateEvent(events, eventId, eventDetails({ name: '' }), OWNER);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.name).toBeTruthy();
  });
});

describe('skydivers', () => {
  it('assigns sequential jumper numbers and never reuses a removed number', () => {
    let { events, eventId } = setup();
    events = unwrap(ops.addSkydiver(events, eventId, skydiverInput({ uspaMembershipId: '1', firstName: 'A', lastName: 'A' }), OWNER));
    events = unwrap(ops.addSkydiver(events, eventId, skydiverInput({ uspaMembershipId: '2', firstName: 'B', lastName: 'B' }), OWNER));
    const b = events[0].skydivers.find((s) => s.lastName === 'B')!;
    expect(b.jumperNumber).toBe(2);

    events = unwrap(ops.removeSkydiver(events, eventId, b.id, OWNER));
    events = unwrap(ops.addSkydiver(events, eventId, skydiverInput({ uspaMembershipId: '3', firstName: 'C', lastName: 'C' }), OWNER));
    expect(events[0].skydivers.map((s) => s.jumperNumber)).toEqual([1, 3]);
  });

  it('rejects a duplicate USPA membership ID within the same event', () => {
    let { events, eventId } = setup();
    events = unwrap(ops.addSkydiver(events, eventId, skydiverInput(), OWNER));
    const r = ops.addSkydiver(events, eventId, skydiverInput({ firstName: 'Someone', lastName: 'Else' }), OWNER);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.uspaMembershipId).toMatch(/Already in this event as #1 Alex Aero/);
  });

  it('allows the same member in different events', () => {
    let { events, eventId } = setup();
    const second = ops.createEvent(events, eventDetails({ name: 'Another' }), OWNER);
    if (!second.ok || !second.id) throw new Error();
    events = unwrap(ops.addSkydiver(second.events, eventId, skydiverInput(), OWNER));
    expect(ops.addSkydiver(events, second.id, skydiverInput(), OWNER).ok).toBe(true);
  });

  it('allows expired memberships (warning only)', () => {
    const { events, eventId } = setup();
    expect(ops.addSkydiver(events, eventId, skydiverInput({ membershipExpiration: '2020-01-01' }), OWNER).ok).toBe(true);
  });

  it('keeps the jumper number when editing and allows keeping the same membership ID', () => {
    let { events, eventId } = setup();
    events = unwrap(ops.addSkydiver(events, eventId, skydiverInput(), OWNER));
    const s = events[0].skydivers[0];
    events = unwrap(ops.updateSkydiver(events, eventId, s.id, skydiverInput({ nickName: 'Ace' }), OWNER));
    expect(events[0].skydivers[0]).toMatchObject({ jumperNumber: 1, nickName: 'Ace' });
  });

  it('non-owners cannot modify the pool', () => {
    const { events, eventId } = setup();
    expect(ops.addSkydiver(events, eventId, skydiverInput(), OTHER).ok).toBe(false);
  });
});
