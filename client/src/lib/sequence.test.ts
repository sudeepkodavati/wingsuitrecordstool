import { describe, expect, it } from 'vitest';
import type { FormationGrid } from '../types';
import { neighbourhoods, percent, pointTransitions } from './sequence';

const grid = (positions: Record<string, [number, number]>, size = 10): FormationGrid => ({
  size,
  positions: Object.fromEntries(Object.entries(positions).map(([id, [row, col]]) => [id, { row, col }])),
});

/** Diamond:  . a .
 *            b . c
 *            . d .   (every skydiver touches two others diagonally) */
const diamond = (r = 0, c = 0) => grid({ a: [r, c + 1], b: [r + 1, c], c: [r + 1, c + 2], d: [r + 2, c + 1] });
const ids = ['a', 'b', 'c', 'd'];

describe('neighbourhoods', () => {
  it('records who is in each of the 8 surrounding cells', () => {
    const n = neighbourhoods(diamond(), ids);
    expect(n.get('a')).toBe('1,-1:b|1,1:c');
    expect(n.get('d')).toBe('-1,-1:b|-1,1:c');
  });

  it('counts diagonal and side-by-side cells, but nothing further away', () => {
    const n = neighbourhoods(grid({ a: [5, 5], b: [4, 4], c: [5, 6], d: [5, 7] }), ids);
    expect(n.get('a')).toBe('-1,-1:b|0,1:c');
    expect(n.get('b')).toBe('1,1:a');
  });
});

describe('pointTransitions', () => {
  it('fails an exact copy', () => {
    expect(pointTransitions([diamond(), diamond()], ids)[0]).toEqual({ from: 1, to: 2, total: 4, changed: 0, required: 3, passes: false });
  });

  it('fails when the whole formation is shifted to new cells (same neighbours)', () => {
    expect(pointTransitions([diamond(0, 0), diamond(4, 5)], ids)[0]).toMatchObject({ changed: 0, passes: false });
  });

  it('passes a mirrored formation: same neighbours, but on different sides', () => {
    const mirrored = grid({ a: [0, 1], c: [1, 0], b: [1, 2], d: [2, 1] });
    expect(pointTransitions([diamond(), mirrored], ids)[0]).toMatchObject({ changed: 4, passes: true });
  });

  it('only skydivers whose neighbourhood changed count (detaching one end of a line)', () => {
    // Line a-b-c-d becomes a-b-c with d detached far away: only c and d see a difference.
    const line = grid({ a: [0, 0], b: [0, 1], c: [0, 2], d: [0, 3] });
    const split = grid({ a: [0, 0], b: [0, 1], c: [0, 2], d: [5, 5] });
    expect(pointTransitions([line, split], ids)[0]).toMatchObject({ changed: 2, required: 3, passes: false });
  });

  it('passes at exactly 75% and fails just below it', () => {
    const line = grid({ a: [0, 0], b: [0, 1], c: [0, 2], d: [0, 3] });
    // b and c swap: a, b, c and d all see different neighbours on at least one side → 4 changed.
    expect(pointTransitions([line, grid({ a: [0, 0], c: [0, 1], b: [0, 2], d: [0, 3] })], ids)[0]).toMatchObject({ changed: 4, passes: true });
    // a moves to the far end: a, b (lost a) and d (gained a) change; c keeps b and d → 3 of 4.
    expect(pointTransitions([line, grid({ b: [0, 1], c: [0, 2], d: [0, 3], a: [0, 4] })], ids)[0]).toMatchObject({ changed: 3, required: 3, passes: true });
  });

  it('rounds the requirement up (9 of 12, 2 of 2)', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `s${i}`);
    const g = grid(Object.fromEntries(twelve.map((id, i) => [id, [0, i] as [number, number]])), 12);
    expect(pointTransitions([g, g], twelve)[0].required).toBe(9);
    expect(pointTransitions([grid({ a: [0, 0], b: [0, 1] }), grid({ a: [0, 0], b: [0, 1] })], ['a', 'b'])[0].required).toBe(2);
  });

  it('checks every consecutive pair, not just 1 → 2', () => {
    const mirrored = grid({ a: [0, 1], c: [1, 0], b: [1, 2], d: [2, 1] });
    expect(pointTransitions([diamond(), mirrored, mirrored], ids).map((t) => [t.from, t.to, t.passes])).toEqual([
      [1, 2, true],
      [2, 3, false],
    ]);
  });

  it('ignores skydivers who are not on the formation (videographers)', () => {
    const withVideo = { ...diamond(), positions: { ...diamond().positions, v: { row: 0, col: 0 } } };
    expect(pointTransitions([diamond(), withVideo], ids)[0]).toMatchObject({ total: 4, changed: 0 });
  });

  it('has no transitions for a single point and passes an empty formation', () => {
    expect(pointTransitions([diamond()], ids)).toEqual([]);
    expect(pointTransitions([grid({}), grid({})], [])[0]).toMatchObject({ total: 0, required: 0, passes: true });
  });
});

describe('percent', () => {
  it('rounds and treats an empty formation as 100%', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(100);
  });
});
