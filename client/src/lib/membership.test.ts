import { describe, expect, it } from 'vitest';
import { membershipStatus, sortByName } from './membership';

const event = { startDate: '2026-10-10', endDate: '2026-10-12' };

describe('membershipStatus', () => {
  it('is expired when it lapses before the event starts', () => {
    expect(membershipStatus('2026-10-09', event)).toBe('expired');
  });
  it('warns when it lapses during the event', () => {
    expect(membershipStatus('2026-10-10', event)).toBe('expires-during-event');
    expect(membershipStatus('2026-10-11', event)).toBe('expires-during-event');
  });
  it('is current when valid through the last day', () => {
    expect(membershipStatus('2026-10-12', event)).toBe('current');
    expect(membershipStatus('2027-01-01', event)).toBe('current');
  });
});

describe('sortByName', () => {
  it('sorts by first name then last name, case-insensitively, without mutating the input', () => {
    const input = [
      { firstName: 'Zed', lastName: 'Adams', jumperNumber: 1 },
      { firstName: 'amy', lastName: 'Young', jumperNumber: 2 },
      { firstName: 'Amy', lastName: 'adams', jumperNumber: 3 },
    ];
    expect(sortByName(input).map((s) => s.jumperNumber)).toEqual([3, 2, 1]);
    expect(input[0].firstName).toBe('Zed');
  });
});
