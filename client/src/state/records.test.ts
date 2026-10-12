import { describe, expect, it } from 'vitest';
import { eventDetails, recordInput, skydiverInput } from '../test/fixtures';
import type { OpResult, RecordEvent } from '../types';
import * as ops from './eventOps';

const OWNER = 'owner-1';

function unwrap(r: OpResult): RecordEvent[] {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.events;
}

/** An event in CA with two skydivers in the pool. */
function setup() {
  const created = ops.createEvent([], eventDetails({ state: 'CA' }), OWNER);
  if (!created.ok || !created.id) throw new Error();
  const eventId = created.id;
  let events = unwrap(ops.addSkydiver(created.events, eventId, skydiverInput({ firstName: 'A', lastName: 'A', uspaMembershipId: '1' }), OWNER));
  events = unwrap(ops.addSkydiver(events, eventId, skydiverInput({ firstName: 'B', lastName: 'B', uspaMembershipId: '2' }), OWNER));
  const [a, b] = events[0].skydivers;
  return { events, eventId, a, b };
}

const errorsOf = (r: OpResult) => (r.ok ? {} : r.errors);

describe('records', () => {
  it('creates a record with skydivers from the pool', () => {
    const { events, eventId, a, b } = setup();
    const r = ops.addRecord(events, eventId, recordInput({ skydiverIds: [a.id, b.id] }), OWNER);
    const record = unwrap(r)[0].records[0];
    expect(record).toMatchObject({ zone: 'national', state: '', type: 'ws-lf-nogrip-vertical', skydiverIds: [a.id, b.id] });
    expect(r.ok && r.id).toBe(record.id);
  });

  it('requires zone and type', () => {
    const { events, eventId } = setup();
    const errors = errorsOf(ops.addRecord(events, eventId, recordInput({ zone: '', type: '' }), OWNER));
    expect(errors).toMatchObject({ zone: 'Select a zone', type: 'Select a record type' });
  });

  it('requires a valid state when the zone is State', () => {
    const { events, eventId } = setup();
    expect(errorsOf(ops.addRecord(events, eventId, recordInput({ zone: 'state', state: '' }), OWNER)).state).toBe('Select a state');
    expect(errorsOf(ops.addRecord(events, eventId, recordInput({ zone: 'state', state: 'ZZ' }), OWNER)).state).toBe('Select a valid state');
    const ok = unwrap(ops.addRecord(events, eventId, recordInput({ zone: 'state', state: 'AZ' }), OWNER));
    expect(ok[0].records[0].state).toBe('AZ');
  });

  it('drops the state for non-state zones', () => {
    const { events, eventId } = setup();
    const ev = unwrap(ops.addRecord(events, eventId, recordInput({ zone: 'uspa-open-national', state: 'CA' }), OWNER));
    expect(ev[0].records[0].state).toBe('');
  });

  it('ignores unknown and repeated skydiver ids', () => {
    const { events, eventId, a } = setup();
    const ev = unwrap(ops.addRecord(events, eventId, recordInput({ skydiverIds: [a.id, a.id, 'ghost'] }), OWNER));
    expect(ev[0].records[0].skydiverIds).toEqual([a.id]);
  });

  it('blocks a duplicate zone + state + type in the same event', () => {
    const { events, eventId } = setup();
    const ev = unwrap(ops.addRecord(events, eventId, recordInput({ zone: 'state', state: 'CA' }), OWNER));
    expect(errorsOf(ops.addRecord(ev, eventId, recordInput({ zone: 'state', state: 'CA' }), OWNER)).type).toMatch(/already has/);
    // Different state or type is fine.
    expect(ops.addRecord(ev, eventId, recordInput({ zone: 'state', state: 'NV' }), OWNER).ok).toBe(true);
    expect(ops.addRecord(ev, eventId, recordInput({ zone: 'state', state: 'CA', type: 'ws-lf-grip' }), OWNER).ok).toBe(true);
  });

  it('updates a record without tripping its own duplicate check', () => {
    const { events, eventId, a } = setup();
    let ev = unwrap(ops.addRecord(events, eventId, recordInput(), OWNER));
    const id = ev[0].records[0].id;
    ev = unwrap(ops.updateRecord(ev, eventId, id, recordInput({ skydiverIds: [a.id] }), OWNER));
    expect(ev[0].records[0].skydiverIds).toEqual([a.id]);
  });

  it('removing a skydiver from the pool removes them from records', () => {
    const { events, eventId, a, b } = setup();
    let ev = unwrap(ops.addRecord(events, eventId, recordInput({ skydiverIds: [a.id, b.id] }), OWNER));
    ev = unwrap(ops.removeSkydiver(ev, eventId, a.id, OWNER));
    expect(ev[0].records[0].skydiverIds).toEqual([b.id]);
  });

  it('saves the formation grid and fills in positions for every skydiver', () => {
    const { events, eventId, a, b } = setup();
    const grid = { size: 6, positions: { [b.id]: { row: 3, col: 3 } } };
    const ev = unwrap(ops.addRecord(events, eventId, recordInput({ skydiverIds: [a.id, b.id], grid }), OWNER));
    expect(ev[0].records[0].grid).toEqual({ size: 6, positions: { [b.id]: { row: 3, col: 3 }, [a.id]: { row: 5, col: 5 } } });
  });

  it('removing a skydiver from the pool clears their grid cell', () => {
    const { events, eventId, a, b } = setup();
    let ev = unwrap(ops.addRecord(events, eventId, recordInput({ skydiverIds: [a.id, b.id] }), OWNER));
    ev = unwrap(ops.removeSkydiver(ev, eventId, a.id, OWNER));
    expect(Object.keys(ev[0].records[0].grid.positions)).toEqual([b.id]);
  });

  it('keeps videographers on the record but off the formation grid', () => {
    const { events, eventId, a } = setup();
    let ev = unwrap(
      ops.addSkydiver(events, eventId, skydiverInput({ firstName: 'Vic', lastName: 'Video', uspaMembershipId: '9', isVideographer: true }), OWNER),
    );
    const v = ev[0].skydivers.find((s) => s.isVideographer)!;
    ev = unwrap(ops.addRecord(ev, eventId, recordInput({ skydiverIds: [a.id, v.id] }), OWNER));
    const record = ev[0].records[0];
    expect(record.skydiverIds).toEqual([a.id, v.id]);
    expect(Object.keys(record.grid.positions)).toEqual([a.id]);
  });

  it('saves the viewpoint and falls back to top-down for bad values', () => {
    const { events, eventId } = setup();
    let ev = unwrap(ops.addRecord(events, eventId, recordInput({ viewpoint: 'back-to-front' }), OWNER));
    expect(ev[0].records[0].viewpoint).toBe('back-to-front');
    ev = unwrap(ops.addRecord(ev, eventId, recordInput({ type: 'ws-lf-grip', viewpoint: 'sideways' as never }), OWNER));
    expect(ev[0].records[1].viewpoint).toBe('top-down');
  });

  it('requires an attempt date within the event dates (inclusive)', () => {
    const { events, eventId } = setup(); // event runs 2026-10-10 → 2026-10-12
    const err = (attemptDate: string) => errorsOf(ops.addRecord(events, eventId, recordInput({ attemptDate }), OWNER)).attemptDate;
    expect(err('')).toBe('Record attempt date is required');
    expect(err('2026-02-30')).toBe('Enter a valid date');
    expect(err('2026-10-09')).toBe('Must be between Oct 10, 2026 and Oct 12, 2026');
    expect(err('2026-10-13')).toBe('Must be between Oct 10, 2026 and Oct 12, 2026');
    expect(err('2026-10-10')).toBeUndefined();
    expect(err('2026-10-12')).toBeUndefined();
  });

  it('only the event owner can manage records', () => {
    const { events, eventId } = setup();
    expect(ops.addRecord(events, eventId, recordInput(), 'intruder').ok).toBe(false);
    const ev = unwrap(ops.addRecord(events, eventId, recordInput(), OWNER));
    const id = ev[0].records[0].id;
    expect(ops.deleteRecord(ev, eventId, id, 'intruder').ok).toBe(false);
    expect(unwrap(ops.deleteRecord(ev, eventId, id, OWNER))[0].records).toHaveLength(0);
  });
});
