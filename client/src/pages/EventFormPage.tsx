import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContactFields } from '../components/ContactFields';
import { Field, TextField } from '../components/FormField';
import { emptyJudge, LOCAL_JUDGE_ROLES, REMOTE_JUDGE_ROLES, withRole } from '../lib/judges';
import { US_STATES } from '../lib/usStates';
import { useEvents } from '../state/EventsContext';
import { useAuth } from '../state/AuthContext';
import type { Contact, EventDetails, FieldErrors, Judge, RecordEvent } from '../types';

const emptyContact = (): Contact => ({ name: '', phone: '', email: '' });

function toDetails(e: RecordEvent): EventDetails {
  const { name, dropZone, city, state, startDate, endDate, aircraft, organizer, localJudge, remoteJudges, notes } = e;
  return {
    name, dropZone, city, state, startDate, endDate, aircraft, organizer, notes,
    localJudge: withRole(localJudge),
    remoteJudges: remoteJudges.map(withRole),
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function EventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getEvent, isOwner, createEvent, updateEvent } = useEvents();
  const { displayName } = useAuth();
  const existing = id ? getEvent(id) : undefined;

  const [values, setValues] = useState<EventDetails>(() =>
    existing
      ? toDetails(existing)
      : {
          name: '',
          dropZone: '',
          city: '',
          state: '',
          startDate: '',
          endDate: '',
          aircraft: '',
          organizer: { ...emptyContact(), name: displayName },
          localJudge: emptyJudge(),
          remoteJudges: [],
          notes: '',
        },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  if (id && !existing) {
    return <p className="text-slate-700">Event not found. <Link to="/" className="text-sky-700 underline">Back to events</Link></p>;
  }
  if (existing && !isOwner(existing)) {
    return (
      <p className="text-slate-700">
        Only the organizer who created this event can edit it.{' '}
        <Link to={`/events/${existing.id}`} className="text-sky-700 underline">Back to event</Link>
      </p>
    );
  }

  const set = <K extends keyof EventDetails>(field: K) => (v: EventDetails[K]) => setValues((s) => ({ ...s, [field]: v }));

  const setRemoteJudge = (i: number, c: Judge) =>
    setValues((s) => ({ ...s, remoteJudges: s.remoteJudges.map((j, idx) => (idx === i ? c : j)) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = existing ? await updateEvent(existing.id, values) : await createEvent(values);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors);
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center' });
      return;
    }
    navigate(`/events/${existing?.id ?? result.id}`);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to={existing ? `/events/${existing.id}` : '/'} className="text-sm text-sky-700 hover:underline">← Back</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{existing ? 'Edit event' : 'New record event'}</h1>
      </div>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form ?? 'Please fix the highlighted fields.'}
        </p>
      )}

      <Section title="Event">
        <TextField label="Event name" value={values.name} onChange={set('name')} error={errors.name} required placeholder="e.g. 2026 Wingsuit Vertical Formation Record" />
        <TextField label="Aircraft" value={values.aircraft} onChange={set('aircraft')} error={errors.aircraft} placeholder="e.g. 2× Twin Otter, Skyvan" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Start date" type="date" value={values.startDate} onChange={set('startDate')} error={errors.startDate} required />
          <TextField label="End date" type="date" value={values.endDate} onChange={set('endDate')} error={errors.endDate} required />
        </div>
      </Section>

      <Section title="Location">
        <TextField label="Drop zone" value={values.dropZone} onChange={set('dropZone')} error={errors.dropZone} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="City" value={values.city} onChange={set('city')} error={errors.city} required className="sm:col-span-2" />
          <Field label="State" error={errors.state} required>
            {(a11y) => (
              <select {...a11y} value={values.state} onChange={(e) => set('state')(e.target.value)} className={`input ${errors.state ? 'input-error' : ''}`}>
                <option value="">Select…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Organizer" description="Phone or email is required.">
        <ContactFields value={values.organizer} onChange={set('organizer')} errors={errors} errorPrefix="organizer" nameLabel="Organizer name" nameRequired />
      </Section>

      <Section title="Local Judge">
        <ContactFields
          value={values.localJudge}
          onChange={set('localJudge')}
          errors={errors}
          errorPrefix="localJudge"
          nameLabel="Name"
          roleOptions={LOCAL_JUDGE_ROLES}
        />
      </Section>

      <Section title="Remote Judges">
        {values.remoteJudges.length === 0 && <p className="text-sm text-slate-500">No remote judges added.</p>}
        {values.remoteJudges.map((j, i) => (
          <div key={i} className="rounded-md border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Remote judge {i + 1}</span>
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => set('remoteJudges')(values.remoteJudges.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </div>
            <ContactFields
              value={j}
              onChange={(c: Judge) => setRemoteJudge(i, c)}
              errors={errors}
              errorPrefix={`remoteJudges.${i}`}
              nameRequired
              roleOptions={REMOTE_JUDGE_ROLES}
              roleRequired
            />
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => set('remoteJudges')([...values.remoteJudges, emptyJudge()])}>
          + Add remote judge
        </button>
      </Section>

      <Section title="Notes">
        <Field label="Notes" error={errors.notes}>
          {(a11y) => (
            <textarea {...a11y} rows={4} value={values.notes} onChange={(e) => set('notes')(e.target.value)} className="input" />
          )}
        </Field>
      </Section>

      <div className="flex justify-end gap-2 pb-8">
        <Link to={existing ? `/events/${existing.id}` : '/'} className="btn-secondary">Cancel</Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
