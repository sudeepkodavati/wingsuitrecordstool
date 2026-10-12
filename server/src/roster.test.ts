import { describe, expect, it } from 'vitest';
import { formatDateRange, membershipStatus, sortByName } from './roster';

describe('membershipStatus', () => {
  it('classifies relative to the event window (inclusive expiration)', () => {
    expect(membershipStatus('2026-10-09', '2026-10-10', '2026-10-12')).toBe('expired');
    expect(membershipStatus('2026-10-10', '2026-10-10', '2026-10-12')).toBe('expires-during-event');
    expect(membershipStatus('2026-10-12', '2026-10-10', '2026-10-12')).toBe('current');
  });
});

describe('sortByName', () => {
  it('sorts by first name, then last name, case-insensitively, then by jumper number', () => {
    const sorted = sortByName([
      { jumperNumber: 3, firstName: 'bob', lastName: 'smith' },
      { jumperNumber: 1, firstName: 'Carl', lastName: 'Adams' },
      { jumperNumber: 2, firstName: 'Bob', lastName: 'Smith' },
      { jumperNumber: 4, firstName: 'Bob', lastName: 'Allen' },
    ]);
    expect(sorted.map((s) => s.jumperNumber)).toEqual([4, 2, 3, 1]);
  });
});

describe('formatDateRange', () => {
  it('formats single and multi-day ranges', () => {
    expect(formatDateRange('2026-10-10', '2026-10-10')).toBe('Oct 10, 2026');
    expect(formatDateRange('2026-10-10', '2026-10-12')).toBe('Oct 10, 2026 – Oct 12, 2026');
  });
});

describe('recordPdfTitle', () => {
  it('appends the participant count, excluding videographers', async () => {
    const { recordPdfTitle } = await import('./pdf');
    const s = (id: string, isVideographer = false) =>
      ({ id, isVideographer, jumperNumber: 1, firstName: 'A', lastName: 'B' }) as never;
    const event = { skydivers: [s('a'), s('b'), s('v', true), s('other')] } as never;
    const record = { title: 'National: WS - Large Formation (Grip)', skydiverIds: ['a', 'b', 'v'] } as never;
    expect(recordPdfTitle(event, record)).toBe('National: WS - Large Formation (Grip) - 2 way');
  });
});
