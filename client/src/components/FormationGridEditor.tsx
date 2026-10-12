import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { MAX_GRID_SIZE, minGridSize, moveInGrid, reconcileGrid } from '../lib/grid';
import { membershipStatus } from '../lib/membership';
import { displayName } from '../lib/names';
import { VIEWPOINT_DESCRIPTIONS, VIEWPOINT_LABELS } from '../lib/viewpoint';
import type { FormationGrid, GridPosition, RecordEvent, Skydiver, Viewpoint } from '../types';
import { ViewpointIcon } from './ViewpointIcon';
import { WingsuitIcon } from './WingsuitIcon';

interface Props {
  event: RecordEvent;
  grid: FormationGrid;
  /** Skydivers on the record, ordered by jumper number. */
  skydiverIds: string[];
  onChange?: (grid: FormationGrid) => void;
  readOnly?: boolean;
  /** Shown as an icon and label above the grid. */
  viewpoint?: Viewpoint;
}

const DRAG_TYPE = 'application/x-wsr-skydiver';
const STATUS_TEXT = { current: '', 'expires-during-event': ' · membership expires during event', expired: ' · membership expired' };

interface GridIconProps {
  s: Skydiver;
  event: RecordEvent;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent, s: Skydiver) => void;
  onDragEnd: () => void;
}

function GridIcon({ s, event, selected, editable, onSelect, onKeyDown, onDragEnd }: GridIconProps) {
  const status = membershipStatus(s.membershipExpiration, event);
  const name = `#${s.jumperNumber} ${displayName(s)}${s.nickName ? ` “${s.nickName}”` : ''}`;
  const color = status === 'expired' ? 'text-red-600' : status === 'expires-during-event' ? 'text-amber-500' : 'text-sky-700';
  return (
    <div className="group absolute inset-0 flex items-center justify-center p-[3%]">
      <button
        type="button"
        data-skydiver-id={s.id}
        draggable={editable}
        disabled={!editable}
        aria-label={`${name}${STATUS_TEXT[status]}`}
        aria-pressed={editable ? selected : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onKeyDown={(e) => onKeyDown(e, s)}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, s.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={onDragEnd}
        className={`h-full w-full rounded-md transition disabled:cursor-default ${color} ${
          editable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${selected ? 'bg-sky-100 ring-2 ring-sky-500' : 'hover:bg-slate-100'}`}
      >
        <WingsuitIcon number={s.jumperNumber} className="h-full w-full" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow group-hover:block"
      >
        {s.firstName}
      </span>
    </div>
  );
}

export function FormationGridEditor({ event, grid, skydiverIds, onChange, readOnly = false, viewpoint }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [sizeDraft, setSizeDraft] = useState(String(grid.size));

  // The icon remounts in its new cell after a keyboard move, so focus has to follow it.
  const refocusId = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!refocusId.current) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-skydiver-id="${refocusId.current}"]`)?.focus();
    refocusId.current = null;
  });

  useEffect(() => setSizeDraft(String(grid.size)), [grid.size]);
  useEffect(() => {
    if (selectedId && !grid.positions[selectedId]) setSelectedId(null);
  }, [grid.positions, selectedId]);

  const skydivers = useMemo(() => new Map(event.skydivers.map((s) => [s.id, s])), [event.skydivers]);
  const occupant = useMemo(() => {
    const m = new Map<string, Skydiver>();
    for (const [id, p] of Object.entries(grid.positions)) {
      const s = skydivers.get(id);
      if (s) m.set(`${p.row}:${p.col}`, s);
    }
    return m;
  }, [grid.positions, skydivers]);

  const minSize = minGridSize(skydiverIds.length);
  const editable = !readOnly && Boolean(onChange);

  const move = (id: string, to: GridPosition) => onChange?.(moveInGrid(grid, id, to));
  const resize = (size: number) => onChange?.(reconcileGrid({ ...grid, size }, skydiverIds));
  const commitSizeDraft = () => {
    const n = Number(sizeDraft);
    if (Number.isFinite(n) && n > 0) resize(n);
    else setSizeDraft(String(grid.size));
  };

  const handleCellClick = (pos: GridPosition, here?: Skydiver) => {
    if (!editable) return;
    if (selectedId) {
      if (here?.id === selectedId) setSelectedId(null);
      else {
        move(selectedId, pos);
        setSelectedId(null);
      }
    } else if (here) {
      setSelectedId(here.id);
    }
  };

  const handleIconKey = (e: KeyboardEvent, s: Skydiver) => {
    const p = grid.positions[s.id];
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (e.key === 'Escape') setSelectedId(null);
    if (!delta[e.key] || !p) return;
    e.preventDefault();
    const [dr, dc] = delta[e.key];
    refocusId.current = s.id;
    move(s.id, { row: p.row + dr, col: p.col + dc });
    setSelectedId(s.id);
  };

  const onDrop = (e: DragEvent, pos: GridPosition) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (id) move(id, pos);
    setSelectedId(null);
  };

  const cells = [];
  for (let row = 0; row < grid.size; row++) {
    for (let col = 0; col < grid.size; col++) {
      const k = `${row}:${col}`;
      const s = occupant.get(k);
      const pos = { row, col };
      const isTarget = dragOver === k || (selectedId !== null && !s);
      cells.push(
        <div
          key={k}
          data-testid={`cell-${row}-${col}`}
          aria-label={`Row ${row + 1}, column ${col + 1}${s ? `: #${s.jumperNumber} ${displayName(s)}` : ', empty'}`}
          onClick={() => handleCellClick(pos, s)}
          onDragOver={editable ? (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOver !== k) setDragOver(k);
          } : undefined}
          onDragLeave={editable ? () => setDragOver((d) => (d === k ? null : d)) : undefined}
          onDrop={editable ? (e) => onDrop(e, pos) : undefined}
          className={`relative border-b border-r border-slate-200 ${
            dragOver === k ? 'bg-sky-100' : isTarget && editable ? 'cursor-pointer hover:bg-sky-50' : ''
          }`}
        >
          {s && (
            <GridIcon
              s={s}
              event={event}
              selected={selectedId === s.id}
              editable={editable}
              onKeyDown={handleIconKey}
              onSelect={() => handleCellClick(pos, s)}
              onDragEnd={() => setDragOver(null)}
            />
          )}
        </div>,
      );
    }
  }

  return (
    <div>
      {editable && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">Grid size</span>
          <div className="flex items-center">
            <button type="button" className="btn-secondary rounded-r-none px-2.5 py-1.5" onClick={() => resize(grid.size - 1)} disabled={grid.size <= minSize} aria-label="Smaller grid">
              −
            </button>
            <input
              type="number"
              min={minSize}
              max={Math.max(MAX_GRID_SIZE, minSize)}
              value={sizeDraft}
              onChange={(e) => setSizeDraft(e.target.value)}
              onBlur={commitSizeDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitSizeDraft();
                }
              }}
              aria-label="Grid size"
              className="input w-16 rounded-none border-x-0 py-1.5 text-center"
            />
            <button type="button" className="btn-secondary rounded-l-none px-2.5 py-1.5" onClick={() => resize(grid.size + 1)} disabled={grid.size >= Math.max(MAX_GRID_SIZE, minSize)} aria-label="Larger grid">
              +
            </button>
          </div>
          <span className="text-slate-500">
            {grid.size} × {grid.size} · min {minSize} to fit {skydiverIds.length}
          </span>
          <button type="button" className="ml-auto text-sky-700 hover:underline" onClick={() => onChange?.(reconcileGrid({ size: grid.size }, skydiverIds))}>
            Reset layout
          </button>
        </div>
      )}
      {viewpoint && (
        <div className="mx-auto mb-2 flex max-w-[640px] items-center gap-2" data-testid="grid-viewpoint">
          <ViewpointIcon viewpoint={viewpoint} className="h-9 w-9 shrink-0" />
          <div className="text-sm leading-tight">
            <div className="font-medium text-slate-900">{VIEWPOINT_LABELS[viewpoint]}</div>
            <div className="text-xs text-slate-500">{VIEWPOINT_DESCRIPTIONS[viewpoint]}</div>
          </div>
        </div>
      )}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Formation grid, ${grid.size} by ${grid.size}`}
        className="mx-auto aspect-square w-full max-w-[640px] border-l border-t border-slate-300 bg-white"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grid.size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.size}, minmax(0, 1fr))`,
        }}
      >
        {cells}
      </div>
      {editable && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Drag a skydiver to another cell (dropping on someone swaps them), or click a skydiver then click a cell. Arrow keys
          move the selected skydiver.
        </p>
      )}
    </div>
  );

}
