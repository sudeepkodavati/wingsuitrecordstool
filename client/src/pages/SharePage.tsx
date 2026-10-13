import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormationGridEditor } from '../components/FormationGridEditor';
import { VideographerBadge } from '../components/VideographerBadge';
import { ViewpointIcon } from '../components/ViewpointIcon';
import { formatDate, formatDateRange } from '../lib/dates';
import { judgeRoleLabel } from '../lib/judges';
import { sortByName } from '../lib/membership';
import { displayName } from '../lib/names';
import { isSequentialType, recordMembers, recordTypeText, recordZoneText } from '../lib/records';
import { toViewEvent, type SharedEvent } from '../lib/share';
import { formationIds, normalizeGrids } from '../lib/validation';
import { VIEWPOINT_LABELS } from '../lib/viewpoint';
import { useEvents } from '../state/EventsContext';
import type { RecordEntry, RecordEvent } from '../types';

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-sky-600 text-white" aria-hidden="true">W</span>
          <span>Wingsuit Records</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Participant view</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function JudgeLine({ name, role }: { name: string; role: string }) {
  if (!name) return <span className="text-slate-400">—</span>;
  const label = judgeRoleLabel(role as never);
  return (
    <span>
      {name}
      {label && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{label}</span>}
    </span>
  );
}

function SharedRecord({ event, record }: { event: RecordEvent; record: RecordEntry }) {
  const formation = formationIds(record.skydiverIds, event);
  const points = normalizeGrids(record.grids, record.type, formation);
  const sequential = isSequentialType(record.type);
  const { participants, videographers } = recordMembers(event, record);

  return (
    <li className="card p-5">
      <h3 className="font-semibold text-slate-900">{recordTypeText(record.type)}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/20">
          {recordZoneText(record)}
        </span>
        {record.attemptDate && <span>Attempt: <span className="font-medium text-slate-800">{formatDate(record.attemptDate)}</span></span>}
        <span>{participants.length}-way</span>
        {sequential && <span>{points.length} point{points.length === 1 ? '' : 's'}</span>}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          {formation.length === 0 ? (
            <p className="text-sm text-slate-500">No formation yet.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <ViewpointIcon viewpoint={record.viewpoint} className="h-7 w-7" />
                <span className="font-medium">{VIEWPOINT_LABELS[record.viewpoint]}</span>
              </div>
              <div className={sequential && points.length > 1 ? 'grid gap-5 sm:grid-cols-2' : 'max-w-md'}>
                {points.map((g, i) => (
                  <div key={i}>
                    {sequential && <h4 className="mb-1.5 text-sm font-medium text-slate-900">Point {i + 1}</h4>}
                    <FormationGridEditor event={event} grid={g} skydiverIds={formation} readOnly neutral />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="text-sm">
          <h4 className="font-medium text-slate-900">Participants ({participants.length})</h4>
          <ul className="mt-1 space-y-0.5">
            {sortByName(participants).map((s) => (
              <li key={s.id}><span className="inline-block w-9 font-mono font-semibold">#{s.jumperNumber}</span>{displayName(s)}</li>
            ))}
          </ul>
          {videographers.length > 0 && (
            <>
              <h4 className="mt-3 font-medium text-slate-900">Videographers ({videographers.length})</h4>
              <ul className="mt-1 space-y-0.5">
                {sortByName(videographers).map((s) => (
                  <li key={s.id}><span className="inline-block w-9 font-mono font-semibold">#{s.jumperNumber}</span>{displayName(s)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** Public, read-only view of one event through a share link. No login, no editing, no PDFs. */
export function SharePage() {
  const { token = '' } = useParams();
  const { loadSharedEvent } = useEvents();
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; data?: SharedEvent }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadSharedEvent(token)
      .then((data) => !cancelled && setState(data ? { status: 'ready', data } : { status: 'missing' }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [token, loadSharedEvent]);

  const event = useMemo(() => (state.data ? toViewEvent(state.data) : null), [state.data]);

  if (state.status === 'loading') {
    return <PublicShell><p className="mt-12 text-center text-sm text-slate-500">Loading…</p></PublicShell>;
  }
  if (state.status !== 'ready' || !event) {
    return (
      <PublicShell>
        <div className="card mx-auto mt-12 max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            {state.status === 'missing' ? "This link isn't active" : 'Could not load this event'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {state.status === 'missing'
              ? 'The organizer may have stopped sharing or created a new link. Ask them for the current one.'
              : 'Please check your connection and try again.'}
          </p>
        </div>
      </PublicShell>
    );
  }

  const skydivers = sortByName(event.skydivers);
  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{event.name}</h1>
          <p className="text-sm text-slate-600">
            {event.dropZone} · {event.city}, {event.state} · {formatDateRange(event.startDate, event.endDate)}
          </p>
        </div>

        <section className="card p-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organizer</dt>
              <dd className="mt-0.5 text-slate-800">{event.organizer.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Local Judge</dt>
              <dd className="mt-0.5 text-slate-800"><JudgeLine name={event.localJudge.name} role={event.localJudge.role} /></dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remote Judges</dt>
              <dd className="mt-0.5 space-y-0.5 text-slate-800">
                {event.remoteJudges.filter((j) => j.name).length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  event.remoteJudges.filter((j) => j.name).map((j, i) => <div key={i}><JudgeLine name={j.name} role={j.role} /></div>)
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Records ({event.records.length})</h2>
          {event.records.length === 0 ? (
            <p className="card px-5 py-8 text-center text-sm text-slate-500">No records yet.</p>
          ) : (
            <ul className="space-y-4">
              {event.records.map((r) => <SharedRecord key={r.id} event={event} record={r} />)}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Skydivers ({skydivers.length})</h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {skydivers.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="w-9 font-mono font-semibold text-slate-900">#{s.jumperNumber}</span>
                <span className="text-slate-800">{displayName(s)}</span>
                {s.isVideographer && <VideographerBadge />}
              </li>
            ))}
          </ul>
        </section>

        <p className="pb-6 text-center text-xs text-slate-500">Read-only view shared by the event organizer.</p>
      </div>
    </PublicShell>
  );
}
