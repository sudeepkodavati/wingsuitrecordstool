import type { FormationGrid } from '../types';

/** At least this share of the formation must change neighbours between consecutive points. */
export const MIN_CHANGED_RATIO = 0.75;

/** The 8 surrounding cells: [row offset, column offset]. */
const AROUND: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export interface PointTransition {
  /** 1-based point numbers, e.g. 1 → 2. */
  from: number;
  to: number;
  /** Skydivers placed on the earlier point. */
  total: number;
  /** How many of them have different neighbours (or neighbours on different sides) on the later point. */
  changed: number;
  /** Minimum that must change: 75% of total, rounded up. */
  required: number;
  passes: boolean;
}

/**
 * Who is next to each skydiver, and on which side: "dr,dc:id" for every formation skydiver in the
 * 8 surrounding cells. Absolute cells don't matter, so moving the whole formation keeps every
 * skydiver's neighbourhood the same.
 */
export function neighbourhoods(grid: FormationGrid, ids: string[]): Map<string, string> {
  const at = new Map<string, string>();
  for (const id of ids) {
    const p = grid.positions[id];
    if (p) at.set(`${p.row}:${p.col}`, id);
  }
  const result = new Map<string, string>();
  for (const id of ids) {
    const p = grid.positions[id];
    if (!p) continue;
    const around = AROUND.flatMap(([dr, dc]) => {
      const other = at.get(`${p.row + dr}:${p.col + dc}`);
      return other ? [`${dr},${dc}:${other}`] : [];
    });
    result.set(id, around.join('|'));
  }
  return result;
}

/**
 * For a sequential record, checks each change between consecutive points (1 → 2, 2 → 3, …):
 * at least 75% of the skydivers on the earlier point must change position relative to the others.
 * A skydiver has changed if they gained or lost a neighbour, or a neighbour is now on a different
 * side; they are unchanged only if every neighbour is the same person in the same spot. Shifting
 * the whole formation therefore counts as no change. `ids` are the formation skydivers
 * (videographers excluded). A point with nobody on it passes.
 */
export function pointTransitions(grids: FormationGrid[], ids: string[]): PointTransition[] {
  const result: PointTransition[] = [];
  for (let i = 0; i + 1 < grids.length; i++) {
    const before = neighbourhoods(grids[i], ids);
    const after = neighbourhoods(grids[i + 1], ids);
    const placed = [...before.keys()];
    const changed = placed.filter((id) => after.get(id) !== before.get(id)).length;
    const required = Math.ceil(placed.length * MIN_CHANGED_RATIO);
    result.push({ from: i + 1, to: i + 2, total: placed.length, changed, required, passes: changed >= required });
  }
  return result;
}

export function percent(part: number, total: number): number {
  return total === 0 ? 100 : Math.round((part / total) * 100);
}
