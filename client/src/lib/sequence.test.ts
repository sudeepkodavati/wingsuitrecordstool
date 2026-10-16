import { describe, expect, it } from 'vitest';
import type { FormationGrid } from '../types';
import { percent, pointTransitions } from './sequence';

const grid = (positions: Record<string, [number, number]>, size = 10): FormationGrid => ({
  size,
  positions: Object.fromEntries(Object.entries(positions).map(([id, [row, col]]) => [id, { row, col }])),
});

const ids = ['a', 'b', 'c', 'd'];
const p1 = grid({ a: [0, 0], b: [0, 1], c: [0, 2], d: [0, 3] });

describe('pointTransitions', () => {
  it('fails an exact copy (nobody moved)', () => {
    const [t] = pointTransitions([p1, p1], ids);
    expect(t).toEqual({ from: 1, to: 2, total: 4, moved: 0, required: 3, passes: false });
  });

  it('passes at exactly 75% and fails just below it', () => {
    const three = grid({ a: [5, 0], b: [5, 1], c: [5, 2], d: [0, 3] });
    const two = grid({ a: [5, 0], b: [5, 1], c: [0, 2], d: [0, 3] });
    expect(pointTransitions([p1, three], ids)[0]).toMatchObject({ moved: 3, required: 3, passes: true });
    expect(pointTransitions([p1, two], ids)[0]).toMatchObject({ moved: 2, required: 3, passes: false });
  });

  it('rounds the requirement up (9 of 12, 2 of 2, 1 of 1)', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `s${i}`);
    const g = grid(Object.fromEntries(twelve.map((id, i) => [id, [0, i] as [number, number]])), 12);
    expect(pointTransitions([g, g], twelve)[0].required).toBe(9);
    expect(pointTransitions([grid({ a: [0, 0], b: [0, 1] }), grid({ a: [0, 0], b: [0, 1] })], ['a', 'b'])[0].required).toBe(2);
    expect(pointTransitions([grid({ a: [0, 0] }), grid({ a: [1, 1] })], ['a'])[0]).toMatchObject({ required: 1, passes: true });
  });

  it('checks every consecutive pair, not just 1 → 2', () => {
    const p2 = grid({ a: [5, 0], b: [5, 1], c: [5, 2], d: [5, 3] });
    const result = pointTransitions([p1, p2, p2], ids);
    expect(result.map((t) => [t.from, t.to, t.passes])).toEqual([
      [1, 2, true],
      [2, 3, false],
    ]);
  });

  it('counts swaps as moves and ignores skydivers who are not on the formation', () => {
    const swapped = grid({ a: [0, 1], b: [0, 0], c: [0, 2], d: [0, 3], v: [9, 9] });
    expect(pointTransitions([p1, swapped], ids)[0]).toMatchObject({ total: 4, moved: 2 });
  });

  it('has no transitions for a single point and passes an empty formation', () => {
    expect(pointTransitions([p1], ids)).toEqual([]);
    expect(pointTransitions([grid({}), grid({})], [])[0]).toMatchObject({ total: 0, required: 0, passes: true });
  });
});

describe('percent', () => {
  it('rounds and treats an empty formation as 100%', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(100);
  });
});
