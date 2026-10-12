import { describe, expect, it } from 'vitest';
import type { RecordEvent } from '../types';
import { toStoreError, withUuids } from './supabaseStore';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keep = '9b2c6c55-1111-4222-8333-444455556666';

describe('withUuids', () => {
  it('replaces non-UUID ids consistently and keeps UUIDs', () => {
    const e = {
      id: 'legacy-1',
      skydivers: [{ id: 'k1abc' }, { id: keep }],
      records: [
        {
          id: 'rec-x',
          skydiverIds: ['k1abc', keep],
          grids: [{ size: 10, positions: { k1abc: { row: 9, col: 9 }, [keep]: { row: 9, col: 8 } } }],
        },
      ],
    } as unknown as RecordEvent;
    const out = withUuids(e);
    const newSky = out.skydivers[0].id;
    expect(out.id).toMatch(UUID);
    expect(newSky).toMatch(UUID);
    expect(out.skydivers[1].id).toBe(keep);
    expect(out.records[0].id).toMatch(UUID);
    expect(out.records[0].skydiverIds).toEqual([newSky, keep]);
    expect(out.records[0].grids[0].positions).toEqual({ [newSky]: { row: 9, col: 9 }, [keep]: { row: 9, col: 8 } });
  });
});

describe('toStoreError', () => {
  const err = (code: string, message = '', details = '') => ({ code, message, details, hint: '', name: 'PostgrestError' }) as never;

  it('maps a duplicate USPA ID to the form field', () => {
    const e = toStoreError(err('23505', 'duplicate key value violates unique constraint "skydivers_event_id_uspa_membership_id_key"'));
    expect(e.fieldErrors).toEqual({ uspaMembershipId: 'Already in this event' });
  });

  it('explains permission errors', () => {
    expect(toStoreError(err('42501')).message).toMatch(/permission/);
    expect(toStoreError(err('PGRST116')).message).toMatch(/permission/);
  });

  it('falls back to a generic message', () => {
    expect(toStoreError(err('XX000')).message).toMatch(/try again/);
  });
});
