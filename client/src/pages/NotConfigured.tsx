/** Shown when client/.env.local is missing the Supabase settings. */
export function NotConfigured() {
  return (
    <div className="mx-auto mt-16 max-w-lg px-4">
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Supabase isn't configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create <code className="rounded bg-slate-100 px-1">client/.env.local</code> with your project's URL and publishable
          key, then restart <code className="rounded bg-slate-100 px-1">npm run dev</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`}
        </pre>
      </div>
    </div>
  );
}
