import { Link } from 'react-router-dom';
import { formatDateRange } from '../lib/dates';
import { membershipStatus } from '../lib/membership';
import { useEvents } from '../state/EventsContext';

export function EventsPage() {
  const { events, isOwner } = useEvents();
  const sorted = [...events].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Record events</h1>
          <p className="text-sm text-slate-600">Wingsuit record attempts and their skydiver pools.</p>
        </div>
        <Link to="/events/new" className="btn-primary">+ New event</Link>
      </div>

      {sorted.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <p className="text-lg font-medium text-slate-900">No record events yet</p>
          <p className="mb-5 mt-1 text-sm text-slate-600">Create an event, then build its skydiver pool.</p>
          <Link to="/events/new" className="btn-primary">Create your first event</Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((e) => {
            const warnings = e.skydivers.filter((s) => membershipStatus(s.membershipExpiration, e) !== 'current').length;
            return (
              <li key={e.id}>
                <Link to={`/events/${e.id}`} className="card block h-full p-5 transition hover:border-sky-300 hover:shadow">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-900">{e.name}</h2>
                    {isOwner(e) && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
                        Yours
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {e.dropZone} · {e.city}, {e.state}
                  </p>
                  <p className="text-sm text-slate-600">{formatDateRange(e.startDate, e.endDate)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-slate-700">
                      <span className="font-semibold">{e.skydivers.length}</span> skydiver{e.skydivers.length === 1 ? '' : 's'}
                    </span>
                    {e.records.length > 0 && (
                      <span className="text-slate-700">
                        <span className="font-semibold">{e.records.length}</span> record{e.records.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {warnings > 0 && <span className="text-amber-700">⚠ {warnings} membership warning{warnings === 1 ? '' : 's'}</span>}
                    <span className="text-slate-500">Organizer: {e.organizer.name}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
