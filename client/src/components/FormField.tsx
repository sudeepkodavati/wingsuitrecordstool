import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

export function Field({ label, error, hint, required, className = '', children }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? msgId : undefined })}
      {error ? (
        <p id={msgId} className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p id={msgId} className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel' | 'date' | 'password';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  className?: string;
  autoFocus?: boolean;
  min?: string;
  max?: string;
}

export function TextField({ label, value, onChange, error, hint, required, className, ...rest }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => (
        <input
          {...a11y}
          {...rest}
          type={rest.type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? 'input-error' : ''}`}
        />
      )}
    </Field>
  );
}
