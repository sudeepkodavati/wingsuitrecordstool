import { describe, expect, it } from 'vitest';
import { splitFullName } from './names';
import { loadLegacyEvents as loadEvents, STORAGE_KEYS } from './storage';

describe('splitFullName', () => {
  it('uses the last word as the last name', () => {
    expect(splitFullName('Alex Aero')).toEqual({ firstName: 'Alex', lastName: 'Aero' });
    expect(splitFullName('  Mary Jane  Watson ')).toEqual({ firstName: 'Mary Jane', lastName: 'Watson' });
    expect(splitFullName('Cher')).toEqual({ firstName: '', lastName: 'Cher' });
  });
});

describe('loadEvents migration', () => {
  it('splits legacy full names and adds missing records', () => {
    const legacy = [{ id: 'e1', skydivers: [{ id: 's1', jumperNumber: 1, fullName: 'Zoe Zephyr' }] }];
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(legacy));
    const [event] = loadEvents();
    expect(event.records).toEqual([]);
    expect(event.skydivers[0]).toEqual({ id: 's1', jumperNumber: 1, firstName: 'Zoe', lastName: 'Zephyr', isVideographer: false });
  });

  it('gives older records the top-down viewpoint', () => {
    const legacy = [{ id: 'e1', skydivers: [], records: [{ id: 'r1', zone: 'national', type: 'ws-lf-grip' }] }];
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(legacy));
    expect(loadEvents()[0].records[0]).toMatchObject({ viewpoint: 'top-down', attemptDate: '' });
  });

  it('turns a legacy single grid into a one-point list', () => {
    const grid = { size: 6, positions: { s1: { row: 1, col: 2 } } };
    const legacy = [{ id: 'e1', skydivers: [], records: [{ id: 'r1', zone: 'national', type: 'ws-lf-grip', grid }] }];
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(legacy));
    const record = loadEvents()[0].records[0] as unknown as Record<string, unknown>;
    expect(record.grids).toEqual([grid]);
    expect(record.grid).toBeUndefined();
  });

  it('leaves current skydivers alone', () => {
    const current = [{ id: 'e1', records: [], skydivers: [{ id: 's1', firstName: 'A', lastName: 'B', isVideographer: true }] }];
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(current));
    expect(loadEvents()[0].skydivers[0]).toEqual({ id: 's1', firstName: 'A', lastName: 'B', isVideographer: true });
  });
});
