import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Field, TextField } from '../components/FormField';
import { formatDateRange } from '../lib/dates';
import { FormationGridEditor } from '../components/FormationGridEditor';
import { SkydiverPicker } from '../components/SkydiverPicker';
import { DEFAULT_GRID_SIZE, reconcileGrid } from '../lib/grid';
import { RECORD_TYPE_LABELS, RECORD_TYPES, RECORD_ZONE_LABELS, RECORD_ZONES } from '../lib/records';
import { US_STATES } from '../lib/usStates';
import { formationIds } from '../lib/validation';
import { useEvents } from '../state/EventsContext';
import { suggestedViewpoint, VIEWPOINT_DESCRIPTIONS, VIEWPOINT_LABELS, VIEWPOINTS } from '../lib/viewpoint';
import type { FieldErrors, RecordInput, RecordType, RecordZone } from '../types';
import { ViewpointIcon } from '../components/ViewpointIcon';

export function RecordFormPage() {
  const { id = '', recordId } = useParams();
  const navigate = useNavigate();
  const { getEvent, isOwner, addRecord, updateRecord } = useEvents();
  const event = getEvent(id);
  const existing = recordId ? event?.records.find((r) => r.id === recordId) : undefined;

  const [values, setValues] = useState<RecordInput>(() =>
    existing && event
      ? {
          zone: existing.zone,
          state: existing.state,
          type: existing.type,
          skydiverIds: existing.skydiverIds,
          // Records saved before the grid existed get a default layout.
          grid: reconcileGrid(existing.grid, formationIds(existing.skydiverIds, event)),
          viewpoint: existing.viewpoint,
          attemptDate: existing.attemptDate,
        }
      : { zone: '', state: '', type: '', skydiverIds: [], grid: { size: DEFAULT_GRID_SIZE, positions: {} }, viewpoint: 'top-down', attemptDate: event?.startDate ?? '' },
  );
  // Until the organizer picks a viewpoint, follow the record type (vertical → back-to-front).
  const [viewpointChosen, setViewpointChosen] = useState(Boolean(existing));
  const [errors, setErrors] = useState<FieldErrors>({});

  if (!event || (recordId && !existing)) {
    return <p className="text-slate-700">{event ? 'Record' : 'Event'} not found. <Link to={event ? `/events/${event.id}` : '/'} className="text-sky-700 underline">Go back</Link></p>;
  }
  if (!isOwner(event)) {
    return (
      <p className="text-slate-700">
        Only the organizer who created this event can manage its records.{' '}
        <Link to={`/events/${event.id}`} className="text-sky-700 underline">Back to event</Link>
      </p>
    );
  }

  const backTo = `/events/${event.id}`;
  const orderedIds = formationIds(values.skydiverIds, event);
  const videographerCount = values.skydiverIds.length - orderedIds.length;

  const setSkydivers = (skydiverIds: string[]) =>
    setValues((v) => ({ ...v, skydiverIds, grid: reconcileGrid(v.grid, formationIds(skydiverIds, event)) }));

  const setZone = (zone: RecordZone | '') =>
    // Default the state to the event's own state the first time "State" is chosen.
    setValues((v) => ({ ...v, zone, state: zone === 'state' ? v.state || event.state : '' }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = existing ? updateRecord(event.id, existing.id, values) : addRecord(event.id, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    navigate(backTo);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to={backTo} className="text-sm text-sky-700 hover:underline">← {event.name}</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{existing ? 'Edit record' : 'New record'}</h1>
      </div>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form ?? 'Please fix the highlighted fields.'}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zone" error={errors.zone} required>
            {(a11y) => (
              <select
                {...a11y}
                value={values.zone}
                onChange={(e) => setZone(e.target.value as RecordZone | '')}
                className={`input ${errors.zone ? 'input-error' : ''}`}
              >
                <option value="">Select…</option>
                {RECORD_ZONES.map((z) => (
                  <option key={z} value={z}>{RECORD_ZONE_LABELS[z]}</option>
                ))}
              </select>
            )}
          </Field>
          {values.zone === 'state' && (
            <Field label="State" error={errors.state} required>
              {(a11y) => (
                <select
                  {...a11y}
                  value={values.state}
                  onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
                  className={`input ${errors.state ? 'input-error' : ''}`}
                >
                  <option value="">Select…</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>
        <TextField
          label="Record attempt date"
          type="date"
          value={values.attemptDate}
          onChange={(attemptDate) => setValues((v) => ({ ...v, attemptDate }))}
          error={errors.attemptDate}
          hint={`Between ${formatDateRange(event.startDate, event.endDate)}`}
          min={event.startDate}
          max={event.endDate}
          required
          className="sm:max-w-xs"
        />
        <Field label="Type" error={errors.type} required>
          {(a11y) => (
            <select
              {...a11y}
              value={values.type}
              onChange={(e) => {
                const type = e.target.value as RecordType | '';
                setValues((v) => ({ ...v, type, viewpoint: viewpointChosen ? v.viewpoint : suggestedViewpoint(type) }));
              }}
              className={`input ${errors.type ? 'input-error' : ''}`}
            >
              <option value="">Select…</option>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          )}
        </Field>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Skydivers</h2>
        <p className="mb-4 mt-0.5 text-sm text-slate-600">Choose who is on this record from the event's skydiver pool.</p>
        <SkydiverPicker event={event} selected={values.skydiverIds} onChange={setSkydivers} />
      </section>

      <section className="card p-5" aria-labelledby="formation-heading">
        <h2 id="formation-heading" className="font-semibold text-slate-900">Formation grid</h2>
        {orderedIds.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            {videographerCount > 0
              ? 'Videographers are not placed on the grid. Select formation skydivers above to activate it.'
              : 'Select skydivers above to activate the grid.'}
          </p>
        ) : (
          <>
            <p className="mb-4 mt-0.5 text-sm text-slate-600">
              Arrange the skydivers in the formation. Hover an icon to see who it is.
              {videographerCount > 0 && ` ${videographerCount} videographer${videographerCount === 1 ? ' is' : 's are'} on this record but not on the grid.`}
            </p>
            <fieldset className="mb-5">
              <legend className="mb-2 text-sm font-medium text-slate-700">Viewpoint</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {VIEWPOINTS.map((vp) => {
                  const checked = values.viewpoint === vp;
                  return (
                    <label
                      key={vp}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400 ${
                        checked ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="viewpoint"
                        value={vp}
                        checked={checked}
                        onChange={() => {
                          setViewpointChosen(true);
                          setValues((v) => ({ ...v, viewpoint: vp }));
                        }}
                        className="sr-only"
                      />
                      <ViewpointIcon viewpoint={vp} className="h-12 w-12 shrink-0" />
                      <span className="text-sm">
                        <span className="block font-medium text-slate-900">{VIEWPOINT_LABELS[vp]}</span>
                        <span className="block text-xs text-slate-500">{VIEWPOINT_DESCRIPTIONS[vp]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <FormationGridEditor
              event={event}
              grid={values.grid}
              skydiverIds={orderedIds}
              viewpoint={values.viewpoint}
              onChange={(grid) => setValues((v) => ({ ...v, grid }))}
            />
          </>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <Link to={backTo} className="btn-secondary">Cancel</Link>
        <button type="submit" className="btn-primary">{existing ? 'Save changes' : 'Create record'}</button>
      </div>
    </form>
  );
}
