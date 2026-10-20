// Vercel Function, called once a day by the cron in vercel.json.
//
// Free Supabase projects pause after about a week without activity, which would break logins and
// share links. This makes one harmless request so the project never counts as inactive: it calls
// the public get_shared_event() function with a token that matches no event, which returns null
// and touches no data. It only needs the public URL and publishable key the site already uses.
//
// If CRON_SECRET is set in Vercel, Vercel's cron sends it as a bearer token and other callers are
// refused.

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return new Response('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set', { status: 500 });
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_shared_event`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: 'keep-alive' }),
    });
    if (!res.ok) return new Response(`Supabase responded ${res.status}`, { status: 502 });
    return new Response('ok', { status: 200 });
  } catch (err) {
    return new Response(`Could not reach Supabase: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
  }
}
