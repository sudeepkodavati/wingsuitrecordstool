import { describe, expect, it } from 'vitest';
import { clampGridSize, minGridSize, moveInGrid, reconcileGrid } from './grid';

describe('grid sizing', () => {
  it('needs a square big enough for everyone, at least 2 × 2', () => {
    expect(minGridSize(0)).toBe(2);
    expect(minGridSize(4)).toBe(2);
    expect(minGridSize(5)).toBe(3);
    expect(minGridSize(101)).toBe(11);
  });

  it('clamps the size between the minimum and 30', () => {
    expect(clampGridSize(1, 9)).toBe(3);
    expect(clampGridSize(99, 9)).toBe(30);
    expect(clampGridSize(NaN, 9)).toBe(10);
  });
});

describe('reconcileGrid', () => {
  it('defaults to 10 × 10 and fills backwards from the last cell in the given order', () => {
    const g = reconcileGrid(undefined, ['a', 'b', 'c']);
    expect(g.size).toBe(10);
    expect(g.positions).toEqual({ a: { row: 9, col: 9 }, b: { row: 9, col: 8 }, c: { row: 9, col: 7 } });
  });

  it('wraps to the row above once the last row is full', () => {
    const g = reconcileGrid({ size: 2, positions: {} }, ['a', 'b', 'c']);
    expect(g.positions.c).toEqual({ row: 0, col: 1 });
  });

  it('keeps existing positions and puts newcomers in the last free cells', () => {
    const g = reconcileGrid({ size: 3, positions: { b: { row: 2, col: 2 } } }, ['a', 'b']);
    expect(g.positions).toEqual({ b: { row: 2, col: 2 }, a: { row: 2, col: 1 } });
  });

  it('drops skydivers no longer on the record', () => {
    const g = reconcileGrid({ size: 3, positions: { a: { row: 0, col: 0 }, gone: { row: 1, col: 1 } } }, ['a']);
    expect(Object.keys(g.positions)).toEqual(['a']);
  });

  it('relocates anyone left outside the grid after shrinking', () => {
    const g = reconcileGrid({ size: 2, positions: { a: { row: 0, col: 0 }, b: { row: 5, col: 5 } } }, ['a', 'b']);
    expect(g.positions.b).toEqual({ row: 1, col: 1 });
  });

  it('grows the grid when there are more skydivers than cells', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `s${i}`);
    expect(reconcileGrid({ size: 3, positions: {} }, ids).size).toBe(4);
  });

  it('resolves two skydivers on the same cell', () => {
    const g = reconcileGrid({ size: 3, positions: { a: { row: 1, col: 1 }, b: { row: 1, col: 1 } } }, ['a', 'b']);
    expect(g.positions.a).toEqual({ row: 1, col: 1 });
    expect(g.positions.b).toEqual({ row: 2, col: 2 });
  });
});

describe('moveInGrid', () => {
  const base = { size: 3, positions: { a: { row: 0, col: 0 }, b: { row: 0, col: 1 } } };

  it('moves to an empty cell', () => {
    expect(moveInGrid(base, 'a', { row: 2, col: 2 }).positions).toEqual({ a: { row: 2, col: 2 }, b: { row: 0, col: 1 } });
  });

  it('swaps with an occupied cell', () => {
    expect(moveInGrid(base, 'a', { row: 0, col: 1 }).positions).toEqual({ a: { row: 0, col: 1 }, b: { row: 0, col: 0 } });
  });

  it('ignores moves off the grid', () => {
    expect(moveInGrid(base, 'a', { row: -1, col: 0 })).toBe(base);
    expect(moveInGrid(base, 'a', { row: 0, col: 3 })).toBe(base);
  });
});
