import { JUDGE_ROLE_LABELS } from '../lib/judges';
import type { Contact, FieldErrors, Judge, JudgeRole } from '../types';
import { Field, TextField } from './FormField';

interface BaseProps {
  errors: FieldErrors;
  /** Error key prefix, e.g. "organizer" or "remoteJudges.0". */
  errorPrefix: string;
  nameLabel?: string;
  nameRequired?: boolean;
}

interface ContactProps extends BaseProps {
  value: Contact;
  onChange: (value: Contact) => void;
}

interface JudgeProps extends BaseProps {
  value: Judge;
  onChange: (value: Judge) => void;
  roleOptions: JudgeRole[];
  roleRequired?: boolean;
}

export function ContactFields(props: ContactProps | JudgeProps) {
  const { value, errors, errorPrefix, nameLabel = 'Name', nameRequired } = props;
  const set = (field: keyof Judge) => (v: string) => (props.onChange as (c: Contact | Judge) => void)({ ...value, [field]: v });
  const roleOptions = 'roleOptions' in props ? props.roleOptions : null;

  return (
    <div className={`grid gap-4 ${roleOptions ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
      {roleOptions && (
        <Field label="Role" error={errors[`${errorPrefix}.role`]} required={(props as JudgeProps).roleRequired}>
          {(a11y) => (
            <select
              {...a11y}
              value={(value as Judge).role}
              onChange={(e) => set('role')(e.target.value)}
              className={`input ${errors[`${errorPrefix}.role`] ? 'input-error' : ''}`}
            >
              <option value="">Select…</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{JUDGE_ROLE_LABELS[r]}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <TextField
        label={nameLabel}
        value={value.name}
        onChange={set('name')}
        error={errors[`${errorPrefix}.name`]}
        required={nameRequired}
        autoComplete="off"
      />
      <TextField
        label="Phone"
        type="tel"
        inputMode="tel"
        value={value.phone}
        onChange={set('phone')}
        error={errors[`${errorPrefix}.phone`]}
        autoComplete="off"
      />
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        value={value.email}
        onChange={set('email')}
        error={errors[`${errorPrefix}.email`]}
        autoComplete="off"
      />
    </div>
  );
}
