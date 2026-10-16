import { useState } from 'react';
import { Link } from 'react-router-dom';
import { membershipStatus, sortByName } from '../lib/membership';
import { displayName } from '../lib/names';
import { exportRecordPdf } from '../lib/pdf';
import { isSequentialType, recordTitle, recordTypeText, recordZoneText } from '../lib/records';
import { pointTransitions } from '../lib/sequence';
import { VIEWPOINT_LABELS } from '../lib/viewpoint';
import { formatDate } from '../lib/dates';
import { attemptInEventRange, formationIds, normalizeGrids } from '../lib/validation';
import { useEvents } from '../state/EventsContext';
import type { RecordEntry, RecordEvent } from '../types';
import { FormationGridEditor } from './FormationGridEditor';
import { PointTransitions } from './PointTransitions';
import { MembershipBadge } from './MembershipBadge';
import { VideographerBadge } from './VideographerBadge';
import { ViewpointIcon } from './ViewpointIcon';

function RecordCard({ event, record, canEdit }: { event: RecordEvent; record: RecordEntry; canEdit: boolean }) {
  const { deleteRecord } = useEvents();
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const byId = new Map(event.skydivers.map((s) => [s.id, s]));
  const formation = formationIds(record.skydiverIds, event);
  const points = normalizeGrids(record.grids, record.type, formation);
  const sequential = isSequentialType(record.type);
  const transitions = sequential ? pointTransitions(points, formation) : [];
  const members = sortByName(record.skydiverIds.flatMap((id) => byId.get(id) ?? []));
  const warnings = members.filter((s) => membershipStatus(s.membershipExpiration, event) !== 'current').length;
  const title = recordTypeText(record.type);
  const videographers = members.filter((s) => s.isVideographer).length;
  const flyers = members.length - videographers;

  const handleDelete = async () => {
    if (window.confirm(`Delete the ${recordZoneText(record)} "${title}" record? The skydivers stay in the event pool.`)) {
      const result = await deleteRecord(event.id, record.id);
      if (!result.ok) setPrintError(result.errors.form ?? 'Could not delete the record.');
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    setPrintError('');
    try {
      await exportRecordPdf(event, record);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/20">
              {recordZoneText(record)}
            </span>
            {record.attemptDate ? (
              <span className="text-slate-600">
                Attempt: <span className="font-medium text-slate-800">{formatDate(record.attemptDate)}</span>
                {!attemptInEventRange(record.attemptDate, event) && (
                  <span className="ml-1.5 text-amber-700">⚠ outside event dates</span>
                )}
              </span>
            ) : (
              <span className="text-amber-700">⚠ No attempt date</span>
            )}
            <span className="text-slate-600">
              {members.length} skydiver{members.length === 1 ? '' : 's'}
              {videographers > 0 && ` (incl. ${videographers} videographer${videographers === 1 ? '' : 's'})`}
            </span>
            {sequential && (
              <span className="text-slate-600">
                {points.length} point{points.length === 1 ? '' : 's'}
              </span>
            )}
            {transitions.length > 0 && <PointTransitions transitions={transitions} compact />}
            {warnings > 0 && <span className="text-amber-700">⚠ {warnings} membership warning{warnings === 1 ? '' : 's'}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="btn-secondary py-1"
            onClick={handlePrint}
            disabled={printing}
            aria-label={`Print PDF for ${recordTitle(record)}`}
          >
            {printing ? 'Printing…' : 'Print PDF'}
          </button>
          {canEdit && (
            <>
              <Link to={`/events/${event.id}/records/${record.id}/edit`} className="text-sky-700 hover:underline" aria-label={`Edit ${title}`}>
                Edit
              </Link>
              <Link
                to={`/events/${event.id}/records/new?from=${record.id}`}
                className="text-sky-700 hover:underline"
                aria-label={`Duplicate ${title}`}
              >
                Duplicate
              </Link>
              <button type="button" className="text-red-600 hover:underline" onClick={handleDelete} aria-label={`Delete ${title}`}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {printError && <p role="alert" className="mt-2 text-sm text-red-600">{printError}</p>}
      {flyers > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none text-slate-600 hover:text-slate-900">
            Show formation{sequential && points.length > 1 ? ` (${points.length} points)` : ''}
          </summary>
          {sequential ? (
            <div className="mt-3">
              <div className="mb-3 flex items-center gap-2 text-slate-700">
                <ViewpointIcon viewpoint={record.viewpoint} className="h-7 w-7" />
                <span className="font-medium">{VIEWPOINT_LABELS[record.viewpoint]}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {points.map((g, i) => (
                  <div key={i}>
                    <h4 className="mb-1.5 font-medium text-slate-900">Point {i + 1}</h4>
                    <FormationGridEditor event={event} grid={g} skydiverIds={formation} readOnly />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 max-w-md">
              <FormationGridEditor event={event} grid={points[0]} skydiverIds={formation} viewpoint={record.viewpoint} readOnly />
            </div>
          )}
        </details>
      )}
      {members.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none text-slate-600 hover:text-slate-900">Show skydivers</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {members.map((s) => {
              const status = membershipStatus(s.membershipExpiration, event);
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-9 font-mono font-semibold text-slate-900">#{s.jumperNumber}</span>
                  <span className="text-slate-800">{displayName(s)}</span>
                  {s.isVideographer && <VideographerBadge />}
                  {status !== 'current' && <MembershipBadge status={status} />}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </li>
  );
}

export function RecordsSection({ event, canEdit }: { event: RecordEvent; canEdit: boolean }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Records</h2>
          <p className="text-sm text-slate-600">
            {event.records.length} record{event.records.length === 1 ? '' : 's'} at this event
          </p>
        </div>
        {canEdit && <Link to={`/events/${event.id}/records/new`} className="btn-primary">+ New record</Link>}
      </div>
      {event.records.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No records yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {event.records.map((r) => (
            <RecordCard key={r.id} event={event} record={r} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}
