import type { FormationGrid } from '../types';

/** At least this share of the formation must change slot between consecutive points. */
export const MIN_CHANGED_RATIO = 0.75;

export interface PointTransition {
  /** 1-based point numbers, e.g. 1 → 2. */
  from: number;
  to: number;
  /** Skydivers placed on the earlier point. */
  total: number;
  /** Minimum that must change slot: 75% of total, rounded up. */
  required: number;
  /** Skydivers the organizer marked on the later point as having changed slot. */
  markedIds: string[];
  marked: number;
  passes: boolean;
}

/**
 * For a sequential record, checks each change between consecutive points (1 → 2, 2 → 3, …)
 * against the organizer's manual marks: the skydivers ticked on the later point
 * (`grid.changedIds`) must be at least 75% (rounded up) of the formation. `ids` are the formation
 * skydivers (videographers excluded). A point with nobody on it passes.
 */
export function pointTransitions(grids: FormationGrid[], ids: string[]): PointTransition[] {
  const result: PointTransition[] = [];
  for (let i = 0; i + 1 < grids.length; i++) {
    const placed = ids.filter((id) => grids[i].positions[id]);
    const required = Math.ceil(placed.length * MIN_CHANGED_RATIO);
    const ticked = new Set(grids[i + 1].changedIds ?? []);
    const markedIds = placed.filter((id) => ticked.has(id));
    result.push({
      from: i + 1,
      to: i + 2,
      total: placed.length,
      required,
      markedIds,
      marked: markedIds.length,
      passes: markedIds.length >= required,
    });
  }
  return result;
}

export function percent(part: number, total: number): number {
  return total === 0 ? 100 : Math.round((part / total) * 100);
}
