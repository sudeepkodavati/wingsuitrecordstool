import { Link, Outlet } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { useAuth } from '../state/AuthContext';
import { useEvents } from '../state/EventsContext';

function UserMenu() {
  const { displayName, email, role, signOut } = useAuth();
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden text-right sm:block">
        <div className="font-medium text-slate-900">{displayName}</div>
        {displayName !== email && <div className="text-xs text-slate-500">{email}</div>}
      </div>
      {role && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{role}</span>
      )}
      <button type="button" className="btn-secondary py-1.5" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="card mx-auto mt-12 max-w-md p-6 text-center">{children}</div>;
}

function Body() {
  const { status, email, signOut } = useAuth();
  const events = useEvents();

  if (status === 'loading') return <p className="mt-12 text-center text-sm text-slate-500">Loading…</p>;
  if (status === 'signed-out') return <LoginPage />;
  if (status === 'no-role') {
    return (
      <Centered>
        <h1 className="text-lg font-semibold text-slate-900">No access yet</h1>
        <p className="mt-2 text-sm text-slate-600">
          You're signed in as <span className="font-medium">{email}</span>, but this account hasn't been given a role.
          Ask your administrator to add you as an organizer.
        </p>
        <button type="button" className="btn-secondary mt-5" onClick={() => signOut()}>
          Sign out
        </button>
      </Centered>
    );
  }
  if (events.status === 'loading') return <p className="mt-12 text-center text-sm text-slate-500">Loading events…</p>;
  if (events.status === 'error') {
    return (
      <Centered>
        <p role="alert" className="text-sm text-red-700">{events.loadError}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => events.reload()}>
          Try again
        </button>
      </Centered>
    );
  }
  return <Outlet />;
}

export function Layout() {
  const { status } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sky-600 text-white" aria-hidden="true">W</span>
            <span>Wingsuit Records</span>
          </Link>
          {status === 'signed-in' && <UserMenu />}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Body />
      </main>
    </div>
  );
}
