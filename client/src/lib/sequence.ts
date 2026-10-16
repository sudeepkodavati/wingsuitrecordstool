import type { FormationGrid } from '../types';

/** At least this share of the formation must change cells between consecutive points. */
export const MIN_MOVED_RATIO = 0.75;

export interface PointTransition {
  /** 1-based point numbers, e.g. 1 → 2. */
  from: number;
  to: number;
  /** Skydivers placed on the earlier point. */
  total: number;
  /** How many of them are in a different cell (row/column) on the later point. */
  moved: number;
  /** Minimum that must move: 75% of total, rounded up. */
  required: number;
  passes: boolean;
}

/**
 * For a sequential record, checks each change between consecutive points (1 → 2, 2 → 3, …):
 * at least 75% of the skydivers on the earlier point must be in a new cell on the next one.
 * `ids` are the formation skydivers (videographers excluded). A point with nobody on it passes.
 */
export function pointTransitions(grids: FormationGrid[], ids: string[]): PointTransition[] {
  const result: PointTransition[] = [];
  for (let i = 0; i + 1 < grids.length; i++) {
    const before = grids[i].positions;
    const after = grids[i + 1].positions;
    const placed = ids.filter((id) => before[id]);
    const moved = placed.filter((id) => {
      const a = before[id];
      const b = after[id];
      return !b || a.row !== b.row || a.col !== b.col;
    }).length;
    const required = Math.ceil(placed.length * MIN_MOVED_RATIO);
    result.push({ from: i + 1, to: i + 2, total: placed.length, moved, required, passes: moved >= required });
  }
  return result;
}

export function percent(moved: number, total: number): number {
  return total === 0 ? 100 : Math.round((moved / total) * 100);
}
