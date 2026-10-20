import type { FormationGrid, GridPosition } from '../types';

export const DEFAULT_GRID_SIZE = 10;
export const MAX_GRID_SIZE = 30;

/** Smallest square grid that fits `count` skydivers (never below 2 × 2). */
export function minGridSize(count: number): number {
  return Math.max(2, Math.ceil(Math.sqrt(count)));
}

export function clampGridSize(size: number, count: number): number {
  const min = minGridSize(count);
  const n = Number.isFinite(size) ? Math.round(size) : DEFAULT_GRID_SIZE;
  return Math.min(Math.max(n, min), Math.max(MAX_GRID_SIZE, min));
}

const key = (p: GridPosition) => `${p.row}:${p.col}`;

/**
 * Brings a grid in line with the skydivers on the record:
 * - clamps the size so everyone fits
 * - keeps existing positions that are in bounds and not colliding
 * - drops skydivers no longer on the record
 * - places everyone else in free cells starting from the last (bottom-right) cell and working
 *   backwards, in the order given
 */
export function reconcileGrid(grid: Partial<FormationGrid> | undefined, orderedIds: string[]): FormationGrid {
  const size = clampGridSize(grid?.size ?? DEFAULT_GRID_SIZE, orderedIds.length);
  const old = grid?.positions ?? {};
  const positions: Record<string, GridPosition> = {};
  const taken = new Set<string>();

  for (const id of orderedIds) {
    const p = old[id];
    if (
      p &&
      Number.isInteger(p.row) &&
      Number.isInteger(p.col) &&
      p.row >= 0 &&
      p.col >= 0 &&
      p.row < size &&
      p.col < size &&
      !taken.has(key(p))
    ) {
      positions[id] = { row: p.row, col: p.col };
      taken.add(key(p));
    }
  }

  let cursor = size * size - 1;
  for (const id of orderedIds) {
    if (positions[id]) continue;
    while (taken.has(key({ row: Math.floor(cursor / size), col: cursor % size }))) cursor--;
    const p = { row: Math.floor(cursor / size), col: cursor % size };
    positions[id] = p;
    taken.add(key(p));
  }
  // Organizer marks only make sense for skydivers still on the formation.
  const marked = grid?.changedIds?.filter((id) => positions[id]);
  return marked && marked.length > 0 ? { size, positions, changedIds: marked } : { size, positions };
}

/** Moves a skydiver to a cell; if another skydiver is there, the two swap places. */
export function moveInGrid(grid: FormationGrid, id: string, to: GridPosition): FormationGrid {
  const from = grid.positions[id];
  if (!from || to.row < 0 || to.col < 0 || to.row >= grid.size || to.col >= grid.size) return grid;
  if (from.row === to.row && from.col === to.col) return grid;
  const positions = { ...grid.positions, [id]: { ...to } };
  const occupant = Object.keys(grid.positions).find(
    (other) => other !== id && grid.positions[other].row === to.row && grid.positions[other].col === to.col,
  );
  if (occupant) positions[occupant] = { ...from };
  return { ...grid, positions };
}

/**
 * Deep copy, so editing the copy never changes the original. Organizer marks are copied too (for
 * duplicating a record); pass `withMarks: false` when the copy is a new point.
 */
export function cloneGrid(grid: FormationGrid, { withMarks = true }: { withMarks?: boolean } = {}): FormationGrid {
  const copy: FormationGrid = {
    size: grid.size,
    positions: Object.fromEntries(Object.entries(grid.positions).map(([id, p]) => [id, { ...p }])),
  };
  if (withMarks && grid.changedIds?.length) copy.changedIds = [...grid.changedIds];
  return copy;
}
