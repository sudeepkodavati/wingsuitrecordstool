import { sortByName } from '../lib/membership';
import { displayName } from '../lib/names';
import type { FormationGrid, RecordEvent } from '../types';

interface Props {
  event: RecordEvent;
  /** 1-based number of the point being marked (2 or more). */
  point: number;
  grid: FormationGrid;
  /** Formation skydivers (videographers excluded). */
  skydiverIds: string[];
  onChange: (changedIds: string[]) => void;
}

/** Option 4: the organizer ticks who changed slot since the previous point. */
export function ChangeMarks({ event, point, grid, skydiverIds, onChange }: Props) {
  const marked = new Set(grid.changedIds ?? []);
  const byId = new Map(event.skydivers.map((s) => [s.id, s]));
  const people = sortByName(skydiverIds.flatMap((id) => byId.get(id) ?? []));

  const toggle = (id: string) => {
    const next = new Set(marked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(skydiverIds.filter((x) => next.has(x)));
  };

  return (
    <fieldset className="mb-4 rounded-md border border-slate-200 px-3 py-2" data-testid="change-marks">
      <legend className="px-1 text-sm font-medium text-slate-800">
        Who changed slot from Point {point - 1} to Point {point}?
      </legend>
      <div className="mb-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Tick each skydiver who changed slot.</span>
        {marked.size > 0 && (
          <button type="button" className="text-sky-700 hover:underline" onClick={() => onChange([])}>
            Clear marks
          </button>
        )}
      </div>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="w-8 font-mono font-semibold text-slate-900">#{s.jumperNumber}</span>
              <span className="text-slate-800">{displayName(s)}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
