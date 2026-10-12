import { useMemo, useState } from 'react';
import { membershipStatus, sortByName } from '../lib/membership';
import { displayName, listName } from '../lib/names';
import type { RecordEvent } from '../types';
import { MembershipBadge } from './MembershipBadge';
import { VideographerBadge } from './VideographerBadge';

interface Props {
  event: RecordEvent;
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Checklist of the event's skydiver pool, sorted by first name, with search and bulk select. */
export function SkydiverPicker({ event, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = sortByName(event.skydivers);
    if (!q) return all;
    return all.filter(
      (s) =>
        displayName(s).toLowerCase().includes(q) ||
        listName(s).toLowerCase().includes(q) ||
        s.nickName.toLowerCase().includes(q) ||
        String(s.jumperNumber) === q.replace(/^#/, '') ||
        s.uspaMembershipId.includes(q),
    );
  }, [event.skydivers, query]);

  const toggle = (id: string) =>
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const allVisibleSelected = visible.length > 0 && visible.every((s) => selectedSet.has(s.id));
  const toggleVisible = () => {
    const ids = visible.map((s) => s.id);
    onChange(
      allVisibleSelected ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])),
    );
  };

  if (event.skydivers.length === 0) {
    return (
      <p className="rounded-md bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        The event's skydiver pool is empty. Add skydivers to the event first, then come back to pick them for this record.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, nick name, # or USPA ID"
          aria-label="Search skydivers"
          className="input max-w-xs flex-1"
        />
        <button type="button" className="btn-secondary py-1.5" onClick={toggleVisible} disabled={visible.length === 0}>
          {allVisibleSelected ? 'Deselect' : 'Select'} {query ? 'matching' : 'all'} ({visible.length})
        </button>
        {selected.length > 0 && (
          <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => onChange([])}>
            Clear selection
          </button>
        )}
        <span className="ml-auto text-sm text-slate-600" aria-live="polite">
          <span className="font-semibold text-slate-900">{selected.length}</span> of {event.skydivers.length} selected
        </span>
      </div>

      <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
        {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No skydivers match “{query}”.</li>}
        {visible.map((s) => {
          const status = membershipStatus(s.membershipExpiration, event);
          const checked = selectedSet.has(s.id);
          return (
            <li key={s.id}>
              <label className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 ${checked ? 'bg-sky-50/60' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="w-10 font-mono font-semibold text-slate-900">#{s.jumperNumber}</span>
                <span className="flex-1">
                  <span className="font-medium text-slate-900">{displayName(s)}</span>
                  {s.nickName && <span className="ml-1.5 text-slate-500">“{s.nickName}”</span>}
                </span>
                {s.isVideographer && <VideographerBadge />}
                {status !== 'current' && <MembershipBadge status={status} />}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
