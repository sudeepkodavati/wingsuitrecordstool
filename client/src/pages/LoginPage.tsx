import { useState, type FormEvent } from 'react';
import { TextField } from '../components/FormField';
import { useAuth } from '../state/AuthContext';

/** Email + password only. Accounts and passwords are managed by an admin in Supabase. */
export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="card mx-auto mt-12 max-w-sm p-6">
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mb-5 mt-1 text-sm text-slate-600">Use the account your administrator created for you.</p>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="username" autoFocus />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-xs text-slate-500">Forgot your password? Ask your administrator to reset it.</p>
    </div>
  );
}
