import { useState, type FormEvent } from 'react';
import { isValidIsoDate } from '../lib/dates';
import { membershipStatus } from '../lib/membership';
import { displayName } from '../lib/names';
import type { FieldErrors, OpResult, RecordEvent, SkydiverInput } from '../types';
import { TextField } from './FormField';
import { MembershipBadge } from './MembershipBadge';

const EMPTY: SkydiverInput = {
  firstName: '',
  lastName: '',
  nickName: '',
  uspaMembershipId: '',
  membershipExpiration: '',
  uspaLicenseNumber: '',
  isVideographer: false,
};

interface Props {
  event: RecordEvent;
  initial?: SkydiverInput;
  jumperNumber: number;
  submitLabel: string;
  onSubmit: (input: SkydiverInput) => OpResult;
  onDone: () => void;
  onCancel: () => void;
  /** When set, a second button saves and resets the form for the next entry. */
  allowAddAnother?: boolean;
}

export function SkydiverForm({ event, initial, jumperNumber, submitLabel, onSubmit, onDone, onCancel, allowAddAnother }: Props) {
  const [values, setValues] = useState<SkydiverInput>(initial ?? EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [number, setNumber] = useState(jumperNumber);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const set = (field: Exclude<keyof SkydiverInput, 'isVideographer'>) => (v: string) => setValues((s) => ({ ...s, [field]: v }));

  const submit = (addAnother: boolean) => {
    const result = onSubmit(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (addAnother) {
      setLastAdded(`#${number} ${displayName(values)} added`);
      setValues(EMPTY);
      setErrors({});
      setNumber((n) => n + 1);
    } else {
      onDone();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(false);
  };

  const status = isValidIsoDate(values.membershipExpiration) ? membershipStatus(values.membershipExpiration, event) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-600">Jumper number</span>
        <span className="font-mono text-base font-semibold text-slate-900" data-testid="jumper-number">#{number}</span>
      </div>
      {lastAdded && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{lastAdded}</p>
      )}
      {errors.form && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} required autoComplete="off" />
        <TextField label="Last name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} required autoComplete="off" />
      </div>
      <TextField label="Nick name" value={values.nickName} onChange={set('nickName')} error={errors.nickName} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="USPA membership ID"
          value={values.uspaMembershipId}
          onChange={set('uspaMembershipId')}
          error={errors.uspaMembershipId}
          inputMode="numeric"
          required
          autoComplete="off"
        />
        <TextField
          label="USPA license number"
          value={values.uspaLicenseNumber}
          onChange={set('uspaLicenseNumber')}
          error={errors.uspaLicenseNumber}
          placeholder="D-12345"
          hint="Optional"
          autoComplete="off"
        />
      </div>
      <div>
        <TextField
          label="Membership expiration"
          type="date"
          value={values.membershipExpiration}
          onChange={set('membershipExpiration')}
          error={errors.membershipExpiration}
          required
        />
        {status && status !== 'current' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <MembershipBadge status={status} />
            <span>You can still add this skydiver — the warning will show on the roster and PDF.</span>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-3 py-2.5">
        <input
          type="checkbox"
          checked={values.isVideographer}
          onChange={(e) => setValues((s) => ({ ...s, isVideographer: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-900">Videographer</span>
          <span className="block text-xs text-slate-500">Can be added to records, but is not placed on the formation grid.</span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {lastAdded ? 'Done' : 'Cancel'}
        </button>
        {allowAddAnother && (
          <button type="button" className="btn-secondary" onClick={() => submit(true)}>
            Save &amp; add another
          </button>
        )}
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
