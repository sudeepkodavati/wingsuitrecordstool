import { useState, type FormEvent } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useOrganizer } from '../state/OrganizerContext';
import { TextField } from './FormField';

function NewProfileForm({ onCreated, compact }: { onCreated?: () => void; compact?: boolean }) {
  const { createProfile } = useOrganizer();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    createProfile(name);
    setName('');
    onCreated?.();
  };
  return (
    <form onSubmit={submit} noValidate className={compact ? 'flex items-end gap-2' : 'space-y-4'}>
      <TextField label="Organizer name" value={name} onChange={setName} error={error} autoFocus className={compact ? 'flex-1' : ''} />
      <button type="submit" className="btn-primary">{compact ? 'Add' : 'Continue'}</button>
    </form>
  );
}

function OrganizerSwitcher() {
  const { profiles, current, switchProfile } = useOrganizer();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" className="btn-secondary py-1.5" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="text-slate-500">Organizer:</span> <span className="max-w-[10rem] truncate">{current?.name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Switch organizer</p>
          <ul className="mb-3 max-h-48 overflow-y-auto">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${p.id === current?.id ? 'font-semibold text-sky-700' : 'text-slate-700'}`}
                  onClick={() => {
                    switchProfile(p.id);
                    setOpen(false);
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <NewProfileForm compact onCreated={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { current } = useOrganizer();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sky-600 text-white" aria-hidden="true">W</span>
            <span>Wingsuit Records</span>
          </Link>
          {current && <OrganizerSwitcher />}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {current ? (
          <Outlet />
        ) : (
          <div className="card mx-auto mt-12 max-w-md p-6">
            <h1 className="text-xl font-semibold text-slate-900">Welcome</h1>
            <p className="mb-5 mt-1 text-sm text-slate-600">
              Enter your name to start managing record events. Events you create can only be edited by you.
            </p>
            <NewProfileForm />
          </div>
        )}
      </main>
    </div>
  );
}
