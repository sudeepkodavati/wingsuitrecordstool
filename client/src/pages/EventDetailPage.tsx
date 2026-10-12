import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { RecordsSection } from '../components/RecordsSection';
import { SkydiverForm } from '../components/SkydiverForm';
import { SkydiverTable } from '../components/SkydiverTable';
import { formatDateRange } from '../lib/dates';
import { judgeRoleLabel } from '../lib/judges';
import { displayName } from '../lib/names';
import { membershipStatus } from '../lib/membership';
import { exportEventPdf } from '../lib/pdf';
import { useEvents } from '../state/EventsContext';
import type { Contact, Judge, Skydiver } from '../types';

function ContactLine({ contact }: { contact: Contact | Judge }) {
  if (!contact.name) return <span className="text-slate-400">—</span>;
  const role = 'role' in contact ? judgeRoleLabel(contact.role) : '';
  return (
    <span>
      {contact.name}
      {role && (
        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{role}</span>
      )}
      {contact.phone && <span className="text-slate-500"> · {contact.phone}</span>}
      {contact.email && (
        <span className="text-slate-500">
          {' · '}
          <a href={`mailto:${contact.email}`} className="text-sky-700 hover:underline">{contact.email}</a>
        </span>
      )}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

type ModalState = { mode: 'add' } | { mode: 'edit'; skydiver: Skydiver } | null;

export function EventDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { getEvent, isOwner, deleteEvent, addSkydiver, updateSkydiver, removeSkydiver } = useEvents();
  const [modal, setModal] = useState<ModalState>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');

  const event = getEvent(id);
  if (!event) {
    return <p className="text-slate-700">Event not found. <Link to="/" className="text-sky-700 underline">Back to events</Link></p>;
  }
  const owner = isOwner(event);
  const warnings = event.skydivers.filter((s) => membershipStatus(s.membershipExpiration, event) !== 'current').length;

  const handleDelete = async () => {
    if (
      window.confirm(
        `Delete "${event.name}", its ${event.skydivers.length} skydiver(s) and ${event.records.length} record(s)? This cannot be undone.`,
      )
    ) {
      const result = await deleteEvent(event.id);
      if (result.ok) navigate('/');
      else setActionError(result.errors.form ?? 'Could not delete the event.');
    }
  };

  const handleRemove = async (s: Skydiver) => {
    const inRecords = event.records.filter((r) => r.skydiverIds.includes(s.id)).length;
    const recordNote = inRecords ? ` They will also be removed from ${inRecords} record${inRecords === 1 ? '' : 's'}.` : '';
    if (window.confirm(`Remove #${s.jumperNumber} ${displayName(s)} from this event? Their jumper number will not be reused.${recordNote}`)) {
      const result = await removeSkydiver(event.id, s.id);
      if (!result.ok) setActionError(result.errors.form ?? 'Could not remove the skydiver.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setActionError('');
    try {
      await exportEventPdf(event);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-sky-700 hover:underline">← All events</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{event.name}</h1>
            <p className="text-sm text-slate-600">
              {event.dropZone} · {event.city}, {event.state} · {formatDateRange(event.startDate, event.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
            {owner && (
              <>
                <Link to={`/events/${event.id}/edit`} className="btn-secondary">Edit event</Link>
                <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
              </>
            )}
          </div>
        </div>
        {actionError && <p role="alert" className="mt-2 text-sm text-red-600">{actionError}</p>}
        {!owner && (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
            View only — this event was created by another organizer profile.
          </p>
        )}
      </div>

      <section className="card p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Aircraft">{event.aircraft || <span className="text-slate-400">—</span>}</Detail>
          <Detail label="Organizer"><ContactLine contact={event.organizer} /></Detail>
          <Detail label="Local Judge"><ContactLine contact={event.localJudge} /></Detail>
          <Detail label="Remote Judges">
            {event.remoteJudges.length === 0 ? (
              <span className="text-slate-400">—</span>
            ) : (
              <ul className="space-y-0.5">
                {event.remoteJudges.map((j, i) => (
                  <li key={i}><ContactLine contact={j} /></li>
                ))}
              </ul>
            )}
          </Detail>
          {event.notes && (
            <div className="sm:col-span-2">
              <Detail label="Notes"><span className="whitespace-pre-wrap">{event.notes}</span></Detail>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Skydiver pool</h2>
            <p className="text-sm text-slate-600">
              {event.skydivers.length} skydiver{event.skydivers.length === 1 ? '' : 's'}, sorted by first name
              {warnings > 0 && <span className="text-amber-700"> · ⚠ {warnings} membership warning{warnings === 1 ? '' : 's'}</span>}
            </p>
          </div>
          {owner && (
            <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'add' })}>+ Add skydiver</button>
          )}
        </div>
        {event.skydivers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No skydivers in the pool yet.</p>
        ) : (
          <SkydiverTable event={event} canEdit={owner} onEdit={(s) => setModal({ mode: 'edit', skydiver: s })} onRemove={handleRemove} />
        )}
      </section>

      <RecordsSection event={event} canEdit={owner} />

      {modal?.mode === 'add' && (
        <Modal title="Add skydiver" onClose={() => setModal(null)}>
          <SkydiverForm
            event={event}
            jumperNumber={event.nextJumperNumber}
            submitLabel="Add skydiver"
            allowAddAnother
            onSubmit={(input) => addSkydiver(event.id, input)}
            onDone={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title={`Edit ${displayName(modal.skydiver)}`} onClose={() => setModal(null)}>
          <SkydiverForm
            event={event}
            initial={modal.skydiver}
            jumperNumber={modal.skydiver.jumperNumber}
            submitLabel="Save changes"
            onSubmit={(input) => updateSkydiver(event.id, modal.skydiver.id, input)}
            onDone={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
