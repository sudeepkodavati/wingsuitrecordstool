import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Field, TextField } from '../components/FormField';
import { formatDateRange } from '../lib/dates';
import { FormationGridEditor } from '../components/FormationGridEditor';
import { ChangeMarks } from '../components/ChangeMarks';
import { PointTransitions } from '../components/PointTransitions';
import { SkydiverPicker } from '../components/SkydiverPicker';
import { cloneGrid } from '../lib/grid';
import { isSequentialType, MAX_POINTS, RECORD_TYPE_LABELS, RECORD_TYPES, RECORD_ZONE_LABELS, RECORD_ZONES, recordTitle } from '../lib/records';
import { US_STATES } from '../lib/usStates';
import { pointTransitions } from '../lib/sequence';
import { formationIds, normalizeGrids, reconcileGrids } from '../lib/validation';
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
  // "Duplicate" opens this form as a new record prefilled from ?from=<recordId>.
  const [search] = useSearchParams();
  const fromId = !recordId ? search.get('from') : null;
  const source = existing ?? (fromId ? event?.records.find((r) => r.id === fromId) : undefined);

  const [values, setValues] = useState<RecordInput>(() =>
    source && event
      ? {
          zone: source.zone,
          state: source.state,
          type: source.type,
          skydiverIds: [...source.skydiverIds],
          // Older records may have no grid yet; copies get their own grid objects.
          grids: normalizeGrids(source.grids, source.type, formationIds(source.skydiverIds, event)).map((g) => cloneGrid(g)),
          viewpoint: source.viewpoint,
          attemptDate: source.attemptDate,
        }
      : { zone: '', state: '', type: '', skydiverIds: [], grids: normalizeGrids([], '', []), viewpoint: 'top-down', attemptDate: event?.startDate ?? '' },
  );
  // Until the organizer picks a viewpoint, follow the record type (vertical → back-to-front).
  const [viewpointChosen, setViewpointChosen] = useState(Boolean(source));
  const [activePoint, setActivePoint] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  if (!event || (recordId && !existing) || (fromId && !source)) {
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

  const sequential = isSequentialType(values.type);
  const extraPointsDropped = !sequential && values.grids.length > 1;
  const visibleGrids = sequential ? values.grids : values.grids.slice(0, 1);
  const point = Math.min(activePoint, visibleGrids.length - 1);
  const transitions = sequential ? pointTransitions(visibleGrids, orderedIds) : [];

  // Keep every point in step with the selected skydivers. Extra points are only trimmed on save,
  // so switching the type back to sequential doesn't lose them.
  const setSkydivers = (skydiverIds: string[]) =>
    setValues((v) => ({ ...v, skydiverIds, grids: reconcileGrids(v.grids, formationIds(skydiverIds, event)) }));

  const setGrid = (index: number, grid: RecordInput['grids'][number]) =>
    setValues((v) => ({ ...v, grids: v.grids.map((g, i) => (i === index ? grid : g)) }));

  /** New point = exact copy of the last one's layout (without its marks), appended at the end. */
  const addPoint = () => {
    setValues((v) => ({ ...v, grids: [...v.grids, cloneGrid(v.grids[v.grids.length - 1], { withMarks: false })] }));
    setActivePoint(values.grids.length);
  };

  const removePoint = (index: number) => {
    if (!window.confirm(`Remove Point ${index + 1}? Its layout will be lost.`)) return;
    setValues((v) => ({ ...v, grids: v.grids.filter((_, i) => i !== index) }));
    setActivePoint(Math.max(0, index - 1));
  };

  const setZone = (zone: RecordZone | '') =>
    // Default the state to the event's own state the first time "State" is chosen.
    setValues((v) => ({ ...v, zone, state: zone === 'state' ? v.state || event.state : '' }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = existing ? await updateRecord(event.id, existing.id, values) : await addRecord(event.id, values);
    setSaving(false);
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
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {existing ? 'Edit record' : source ? 'Duplicate record' : 'New record'}
        </h1>
        {!existing && source && (
          <p className="mt-1 text-sm text-slate-600">
            Copy of <span className="font-medium">{recordTitle(source)}</span>. Nothing is saved until you click Create record.
          </p>
        )}
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
        <h2 id="formation-heading" className="font-semibold text-slate-900">{sequential ? 'Formation points' : 'Formation grid'}</h2>
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
            {extraPointsDropped && (
              <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠ This record type has a single formation. Only Point 1 will be kept when you save
                ({values.grids.length - 1} other point{values.grids.length === 2 ? '' : 's'} will be removed).
              </p>
            )}
            {sequential && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Formation points" className="flex flex-wrap gap-1">
                  {visibleGrids.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === point}
                      onClick={() => setActivePoint(i)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        i === point ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Point {i + 1}
                      {i > 0 && transitions[i - 1] && !transitions[i - 1].passes && (
                        <>
                          {' '}
                          <span title="Fewer than 75% marked as changed slot from the previous point">
                            <span aria-hidden="true">⚠</span>
                            <span className="sr-only">(needs changes)</span>
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary py-1.5"
                  onClick={addPoint}
                  disabled={values.grids.length >= MAX_POINTS}
                  title={`Copies Point ${values.grids.length} exactly`}
                >
                  + Add point
                </button>
                {visibleGrids.length > 1 && (
                  <button type="button" className="ml-auto text-sm text-red-600 hover:underline" onClick={() => removePoint(point)}>
                    Remove Point {point + 1}
                  </button>
                )}
              </div>
            )}
            {transitions.length > 0 && (
              <div className="mb-4">
                <PointTransitions transitions={transitions} />
              </div>
            )}
            {sequential && point > 0 && transitions[point - 1] && (
              <ChangeMarks
                key={`marks-${point}`}
                event={event}
                point={point + 1}
                grid={visibleGrids[point]}
                skydiverIds={orderedIds}
                onChange={(changedIds) => setGrid(point, { ...visibleGrids[point], changedIds })}
              />
            )}
            <FormationGridEditor
              key={point}
              event={event}
              grid={visibleGrids[point]}
              skydiverIds={orderedIds}
              viewpoint={values.viewpoint}
              onChange={(grid) => setGrid(point, grid)}
            />
          </>
        )}
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <Link to={backTo} className="btn-secondary">Cancel</Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create record'}
        </button>
      </div>
    </form>
  );
}
