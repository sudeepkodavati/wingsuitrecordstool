/**
 * Database permission tests against the LOCAL Supabase stack (`npx supabase start`).
 * Run with `npm run test:db`. Uses throwaway accounts created with the local stack's service key,
 * which is a well-known development key; nothing here touches the hosted project.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Status = Record<string, string>;

function localStatus(): Status {
  const root = resolve(__dirname, '../../..');
  try {
    const out = execSync('npx supabase status -o json', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return JSON.parse(out.slice(out.indexOf('{')));
  } catch {
    throw new Error('Local Supabase is not running. Start Docker, then run `npx supabase start` in the repo root.');
  }
}

const status = localStatus();
const url = status.API_URL;
const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const service = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);

const run = Date.now();
const password = `test-${run}-Pw!`;
const users: Record<'admin' | 'orgA' | 'orgB' | 'noRole', { id: string; client: SupabaseClient }> = {} as never;

async function makeUser(key: keyof typeof users, role: 'admin' | 'organizer' | null) {
  const email = `${key.toLowerCase()}-${run}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role) {
    const { error: e } = await service.from('user_roles').insert({ user_id: data.user.id, role, display_name: key });
    if (e) throw e;
  }
  const client = createClient(url, anonKey, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  users[key] = { id: data.user.id, client };
}

const newEvent = (name: string) => ({
  name,
  drop_zone: 'Skydive Perris',
  city: 'Perris',
  state: 'CA',
  start_date: '2026-10-20',
  end_date: '2026-10-22',
  organizer: { name: 'Org', phone: '555', email: '' },
});

const newSkydiver = (eventId: string, n: number, extra: Record<string, unknown> = {}) => ({
  event_id: eventId,
  first_name: `First${n}`,
  last_name: `Last${n}`,
  uspa_membership_id: String(1000 + n),
  membership_expiration: '2027-06-30',
  ...extra,
});

async function createEvent(client: SupabaseClient, name: string) {
  const { data, error } = await client.from('events').insert(newEvent(name)).select().single();
  if (error) throw error;
  return data as { id: string; created_by: string };
}

beforeAll(async () => {
  await makeUser('admin', 'admin');
  await makeUser('orgA', 'organizer');
  await makeUser('orgB', 'organizer');
  await makeUser('noRole', null);
}, 60_000);

afterAll(async () => {
  const ids = Object.values(users).map((u) => u.id);
  await service.from('events').delete().in('created_by', ids);
  for (const id of ids) await service.auth.admin.deleteUser(id);
});

describe('anonymous visitors', () => {
  it.each(['events', 'skydivers', 'records', 'user_roles'])('cannot read %s', async (table) => {
    const { data, error } = await anon.from(table).select('*');
    expect(error?.code ?? (data?.length === 0 ? 'empty' : 'rows')).not.toBe('rows');
    expect(error).not.toBeNull();
  });

  it('cannot create events', async () => {
    const { error } = await anon.from('events').insert(newEvent('Anon'));
    expect(error).not.toBeNull();
  });
});

describe('roles', () => {
  it('organizers read only their own role; admins read all', async () => {
    const own = await users.orgA.client.from('user_roles').select('user_id, role');
    expect(own.data).toEqual([{ user_id: users.orgA.id, role: 'organizer' }]);
    const all = await users.admin.client.from('user_roles').select('user_id').in('user_id', Object.values(users).map((u) => u.id));
    expect(all.data).toHaveLength(3); // noRole has no row
  });

  it('roles cannot be changed through the API', async () => {
    const { error } = await users.orgA.client.from('user_roles').update({ role: 'admin' }).eq('user_id', users.orgA.id);
    expect(error).not.toBeNull();
    const ins = await users.noRole.client.from('user_roles').insert({ user_id: users.noRole.id, role: 'admin' });
    expect(ins.error).not.toBeNull();
  });
});

describe('events', () => {
  it('organizers create events they own; others cannot see or change them; admins can', async () => {
    const ev = await createEvent(users.orgA.client, 'A event');
    expect(ev.created_by).toBe(users.orgA.id);

    const seenByB = await users.orgB.client.from('events').select('id').eq('id', ev.id);
    expect(seenByB.data).toEqual([]);
    const updByB = await users.orgB.client.from('events').update({ name: 'hijack' }).eq('id', ev.id).select();
    expect(updByB.data).toEqual([]);
    const delByB = await users.orgB.client.from('events').delete().eq('id', ev.id).select();
    expect(delByB.data).toEqual([]);

    const byAdmin = await users.admin.client.from('events').update({ name: 'Renamed by admin' }).eq('id', ev.id).select().single();
    expect(byAdmin.data?.name).toBe('Renamed by admin');
  });

  it('users without a role cannot create events', async () => {
    const { error } = await users.noRole.client.from('events').insert(newEvent('No role'));
    expect(error).not.toBeNull();
  });

  it('owner and jumper counter cannot be set or changed by the client', async () => {
    const forged = await users.orgA.client.from('events').insert({ ...newEvent('Forged'), created_by: users.orgB.id });
    expect(forged.error).not.toBeNull();
    const ev = await createEvent(users.orgA.client, 'Counter');
    const bump = await users.orgA.client.from('events').update({ next_jumper_number: 1 }).eq('id', ev.id);
    expect(bump.error).not.toBeNull();
    const move = await users.orgA.client.from('events').update({ created_by: users.orgB.id }).eq('id', ev.id);
    expect(move.error).not.toBeNull();
  });

  it('rejects an end date before the start date', async () => {
    const { error } = await users.orgA.client.from('events').insert({ ...newEvent('Bad dates'), end_date: '2026-10-01' });
    expect(error).not.toBeNull();
  });
});

describe('skydivers', () => {
  it('assigns sequential jumper numbers and never reuses a removed one', async () => {
    const ev = await createEvent(users.orgA.client, 'Numbers');
    const c = users.orgA.client;
    const add = async (n: number) => (await c.from('skydivers').insert(newSkydiver(ev.id, n)).select().single()).data!;
    const s1 = await add(1);
    const s2 = await add(2);
    expect([s1.jumper_number, s2.jumper_number]).toEqual([1, 2]);
    await c.from('skydivers').delete().eq('id', s2.id);
    expect((await add(3)).jumper_number).toBe(3);
  });

  it('keeps an imported jumper number and moves the counter past it', async () => {
    const ev = await createEvent(users.orgA.client, 'Import');
    const c = users.orgA.client;
    const imported = await c.from('skydivers').insert(newSkydiver(ev.id, 1, { jumper_number: 10 })).select().single();
    expect(imported.data?.jumper_number).toBe(10);
    const next = await c.from('skydivers').insert(newSkydiver(ev.id, 2)).select().single();
    expect(next.data?.jumper_number).toBe(11);
  });

  it('rejects a duplicate USPA ID in the same event, but allows it in another event', async () => {
    const c = users.orgA.client;
    const ev1 = await createEvent(c, 'Dup 1');
    const ev2 = await createEvent(c, 'Dup 2');
    await c.from('skydivers').insert(newSkydiver(ev1.id, 5));
    const dup = await c.from('skydivers').insert(newSkydiver(ev1.id, 5, { first_name: 'Other' }));
    expect(dup.error?.code).toBe('23505');
    expect((await c.from('skydivers').insert(newSkydiver(ev2.id, 5))).error).toBeNull();
  });

  it("other organizers can't add to or read someone else's pool", async () => {
    const ev = await createEvent(users.orgA.client, 'Private pool');
    await users.orgA.client.from('skydivers').insert(newSkydiver(ev.id, 1));
    expect((await users.orgB.client.from('skydivers').insert(newSkydiver(ev.id, 2))).error).not.toBeNull();
    expect((await users.orgB.client.from('skydivers').select('id').eq('event_id', ev.id)).data).toEqual([]);
  });

  it('jumper number and event cannot be changed after insert', async () => {
    const ev = await createEvent(users.orgA.client, 'Locked');
    const s = (await users.orgA.client.from('skydivers').insert(newSkydiver(ev.id, 1)).select().single()).data!;
    expect((await users.orgA.client.from('skydivers').update({ jumper_number: 99 }).eq('id', s.id)).error).not.toBeNull();
    expect((await users.orgA.client.from('skydivers').update({ first_name: 'Renamed' }).eq('id', s.id)).error).toBeNull();
  });
});

describe('records', () => {
  it('removing a skydiver takes them off the record and every formation point', async () => {
    const c = users.orgA.client;
    const ev = await createEvent(c, 'Records');
    const a = (await c.from('skydivers').insert(newSkydiver(ev.id, 1)).select().single()).data!;
    const b = (await c.from('skydivers').insert(newSkydiver(ev.id, 2)).select().single()).data!;
    const grids = [0, 1].map(() => ({ size: 10, positions: { [a.id]: { row: 9, col: 9 }, [b.id]: { row: 9, col: 8 } } }));
    const rec = await c
      .from('records')
      .insert({ event_id: ev.id, zone: 'national', type: 'ws-seq-lf-nogrip-vertical', skydiver_ids: [a.id, b.id], grids, attempt_date: '2026-10-21' })
      .select()
      .single();
    expect(rec.error).toBeNull();

    await c.from('skydivers').delete().eq('id', a.id);
    const after = (await c.from('records').select('skydiver_ids, grids').eq('id', rec.data!.id).single()).data!;
    expect(after.skydiver_ids).toEqual([b.id]);
    expect(after.grids.map((g: { positions: object }) => Object.keys(g.positions))).toEqual([[b.id], [b.id]]);
  });

  it('requires a state for State records', async () => {
    const ev = await createEvent(users.orgA.client, 'State check');
    const { error } = await users.orgA.client.from('records').insert({ event_id: ev.id, zone: 'state', state: '', type: 'ws-lf-grip' });
    expect(error).not.toBeNull();
  });

  it('deleting an event deletes its skydivers and records', async () => {
    const c = users.orgA.client;
    const ev = await createEvent(c, 'Cascade');
    await c.from('skydivers').insert(newSkydiver(ev.id, 1));
    await c.from('records').insert({ event_id: ev.id, zone: 'national', type: 'ws-lf-grip' });
    await c.from('events').delete().eq('id', ev.id);
    const left = await service.from('skydivers').select('id').eq('event_id', ev.id);
    expect(left.data).toEqual([]);
  });
});

describe('losing a role', () => {
  it('an organizer whose role is removed loses access to their own events', async () => {
    const ev = await createEvent(users.orgB.client, 'Before removal');
    await service.from('user_roles').delete().eq('user_id', users.orgB.id);
    expect((await users.orgB.client.from('events').select('id').eq('id', ev.id)).data).toEqual([]);
    await service.from('user_roles').insert({ user_id: users.orgB.id, role: 'organizer', display_name: 'orgB' });
    expect((await users.orgB.client.from('events').select('id').eq('id', ev.id)).data).toHaveLength(1);
  });
});

describe('share links', () => {
  async function sharedSetup() {
    const c = users.orgA.client;
    const ev = await createEvent(c, 'Shared event');
    await c.from('events').update({
      local_judge: { name: 'Sam Safety', phone: '555-0111', email: 'sam@example.com', role: 'dz-sta' },
      remote_judges: [{ name: 'Remy Remote', phone: '', email: 'remy@example.com', role: 'national' }],
      notes: 'Private organizer notes',
    }).eq('id', ev.id);
    const a = (await c.from('skydivers').insert(newSkydiver(ev.id, 1, { uspa_license_number: 'D-1' })).select().single()).data!;
    const v = (await c.from('skydivers').insert(newSkydiver(ev.id, 2, { is_videographer: true })).select().single()).data!;
    await c.from('records').insert({
      event_id: ev.id,
      zone: 'state',
      state: 'CA',
      type: 'ws-lf-grip',
      skydiver_ids: [a.id, v.id],
      grids: [{ size: 10, positions: { [a.id]: { row: 9, col: 9 } } }],
      attempt_date: '2026-10-21',
    });
    return { ev, a, v };
  }

  const share = (client: SupabaseClient, eventId: string, enabled: boolean) =>
    client.rpc('set_event_sharing', { p_event_id: eventId, p_enabled: enabled });

  it('lets anonymous visitors read a shared event without any personal details', async () => {
    const { ev, a } = await sharedSetup();
    const { data: token, error } = await share(users.orgA.client, ev.id, true);
    expect(error).toBeNull();

    const { data, error: readError } = await anon.rpc('get_shared_event', { p_token: token });
    expect(readError).toBeNull();
    expect(data.event).toMatchObject({
      name: 'Shared event',
      organizerName: 'Org',
      localJudge: { name: 'Sam Safety', role: 'dz-sta' },
      remoteJudges: [{ name: 'Remy Remote', role: 'national' }],
    });
    expect(data.skydivers[0]).toEqual({ id: a.id, jumperNumber: 1, firstName: 'First1', lastName: 'Last1', isVideographer: false });
    expect(data.skydivers[1].isVideographer).toBe(true);
    expect(data.records[0]).toMatchObject({ zone: 'state', state: 'CA', type: 'ws-lf-grip', attemptDate: '2026-10-21' });
    expect(data.records[0].grids[0].positions[a.id]).toEqual({ row: 9, col: 9 });

    const json = JSON.stringify(data);
    for (const secret of ['1001', 'D-1', '2027-06-30', '555', '@example.com', 'Private organizer notes']) {
      expect(json).not.toContain(secret);
    }
  });

  it('a stopped or replaced link no longer works', async () => {
    const { ev } = await sharedSetup();
    const first = (await share(users.orgA.client, ev.id, true)).data;
    const second = (await share(users.orgA.client, ev.id, true)).data;
    expect(second).not.toBe(first);
    expect((await anon.rpc('get_shared_event', { p_token: first })).data).toBeNull();
    expect((await anon.rpc('get_shared_event', { p_token: second })).data).not.toBeNull();

    const off = await share(users.orgA.client, ev.id, false);
    expect(off.data).toBeNull();
    expect((await anon.rpc('get_shared_event', { p_token: second })).data).toBeNull();
  });

  it('unknown and malformed tokens return nothing', async () => {
    expect((await anon.rpc('get_shared_event', { p_token: crypto.randomUUID() })).data).toBeNull();
    const garbage = await anon.rpc('get_shared_event', { p_token: "x' or 1=1 --" });
    expect(garbage.error).toBeNull();
    expect(garbage.data).toBeNull();
  });

  it('only the owner or an admin can change sharing; anonymous visitors cannot', async () => {
    const { ev } = await sharedSetup();
    expect((await share(users.orgB.client, ev.id, true)).error).not.toBeNull();
    expect((await share(anon, ev.id, true)).error).not.toBeNull();
    expect((await share(users.admin.client, ev.id, true)).error).toBeNull();
  });

  it('sharing does not open the tables to anonymous visitors', async () => {
    const { ev } = await sharedSetup();
    await share(users.orgA.client, ev.id, true);
    expect((await anon.from('events').select('id').eq('id', ev.id)).error).not.toBeNull();
    expect((await anon.from('skydivers').select('id').eq('event_id', ev.id)).error).not.toBeNull();
  });

  it('share_token cannot be written directly', async () => {
    const { ev } = await sharedSetup();
    const { error } = await users.orgA.client.from('events').update({ share_token: crypto.randomUUID() }).eq('id', ev.id);
    expect(error).not.toBeNull();
  });
});
