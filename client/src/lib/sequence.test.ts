import { describe, expect, it } from 'vitest';
import type { FormationGrid } from '../types';
import { percent, pointTransitions } from './sequence';

const grid = (positions: Record<string, [number, number]>, changedIds?: string[]): FormationGrid => ({
  size: 10,
  positions: Object.fromEntries(Object.entries(positions).map(([id, [row, col]]) => [id, { row, col }])),
  ...(changedIds ? { changedIds } : {}),
});

const ids = ['a', 'b', 'c', 'd'];
const layout = (changedIds?: string[]) => grid({ a: [0, 1], b: [1, 0], c: [1, 2], d: [2, 1] }, changedIds);

describe('pointTransitions (organizer marks)', () => {
  it('fails with no marks', () => {
    expect(pointTransitions([layout(), layout()], ids)[0]).toEqual({
      from: 1,
      to: 2,
      total: 4,
      required: 3,
      markedIds: [],
      marked: 0,
      passes: false,
    });
  });

  it('passes at exactly 75% and fails just below it', () => {
    expect(pointTransitions([layout(), layout(['a', 'b', 'c'])], ids)[0]).toMatchObject({ marked: 3, passes: true });
    expect(pointTransitions([layout(), layout(['a', 'b'])], ids)[0]).toMatchObject({ marked: 2, passes: false });
  });

  it('counts marks only, not where people are on the grid', () => {
    // Nobody moved, but the organizer judged three changed slot: that is what counts.
    expect(pointTransitions([layout(), layout(['a', 'b', 'c'])], ids)[0].passes).toBe(true);
  });

  it('rounds the requirement up (9 of 12, 2 of 2)', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `s${i}`);
    const g = grid(Object.fromEntries(twelve.map((id, i) => [id, [0, i] as [number, number]])));
    expect(pointTransitions([g, g], twelve)[0].required).toBe(9);
    expect(pointTransitions([grid({ a: [0, 0], b: [0, 1] }), grid({ a: [0, 0], b: [0, 1] })], ['a', 'b'])[0].required).toBe(2);
  });

  it("checks every consecutive pair using each point's own marks", () => {
    const result = pointTransitions([layout(), layout(['a', 'b', 'c', 'd']), layout(['a'])], ids);
    expect(result.map((t) => [t.from, t.to, t.marked, t.passes])).toEqual([
      [1, 2, 4, true],
      [2, 3, 1, false],
    ]);
  });

  it('ignores marks for skydivers who are not on the formation (videographers, removed people)', () => {
    expect(pointTransitions([layout(), layout(['a', 'v', 'gone'])], ids)[0]).toMatchObject({ markedIds: ['a'], marked: 1 });
  });

  it('has no transitions for a single point and passes an empty formation', () => {
    expect(pointTransitions([layout()], ids)).toEqual([]);
    expect(pointTransitions([grid({}), grid({})], [])[0]).toMatchObject({ total: 0, required: 0, passes: true });
  });
});

describe('percent', () => {
  it('rounds and treats an empty formation as 100%', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(100);
  });
});
