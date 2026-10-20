// Tests for api/keep-alive.mjs (Node's built-in test runner): npm run test:api
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { GET } from '../api/keep-alive.mjs';

const realFetch = globalThis.fetch;
const env = { ...process.env };
let calls;

beforeEach(() => {
  calls = [];
  process.env.VITE_SUPABASE_URL = 'https://abc.supabase.co/';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  delete process.env.CRON_SECRET;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response('null', { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

const request = (headers = {}) => new Request('https://example.vercel.app/api/keep-alive', { headers });

test('pings the public share function with the publishable key', async () => {
  const res = await GET(request());
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://abc.supabase.co/rest/v1/rpc/get_shared_event');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_test');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_token: 'keep-alive' });
});

test('reports a Supabase error as 502', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 503 });
  const res = await GET(request());
  assert.equal(res.status, 502);
});

test('reports a network failure as 502', async () => {
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  const res = await GET(request());
  assert.equal(res.status, 502);
  assert.match(await res.text(), /offline/);
});

test('fails clearly when the Supabase variables are missing', async () => {
  delete process.env.VITE_SUPABASE_URL;
  const res = await GET(request());
  assert.equal(res.status, 500);
  assert.equal(calls.length, 0);
});

test('with CRON_SECRET set, only requests carrying it are accepted', async () => {
  process.env.CRON_SECRET = 's3cret';
  assert.equal((await GET(request())).status, 401);
  assert.equal((await GET(request({ authorization: 'Bearer wrong' }))).status, 401);
  assert.equal((await GET(request({ authorization: 'Bearer s3cret' }))).status, 200);
  assert.equal(calls.length, 1);
});
