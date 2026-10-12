-- Wingsuit Records: initial schema.
--
-- Roles: `admin` (everything) and `organizer` (manages the events they created). Accounts and roles
-- are created by an admin in the Supabase dashboard; the app has no sign-up or password screens.
-- Participants (anonymous visitors) get no table access at all; share links are added later.
--
-- Written for projects where "Automatically expose new tables" is OFF, so every grant below is
-- explicit. It also revokes anon access, in case that setting is on.

-- ---------------------------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'organizer')),
  -- Shown in the app header and used to prefill the event's organizer name.
  display_name text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.user_roles is
  'One row per person allowed into the app. No row = no access. Managed by an admin in the dashboard.';

-- The signed-in user's role, or null. SECURITY DEFINER so RLS policies can read it without
-- recursing through user_roles' own policy.
create function public.app_role() returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.user_roles where user_id = (select auth.uid())
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

create function public.can_create_events() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.app_role() in ('admin', 'organizer'), false)
$$;

-- ---------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- Owner. Defaults to the caller and is not writable through the API (see grants below).
  -- RESTRICT: an organizer with events can't be deleted until their events are removed or moved.
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  drop_zone text not null default '',
  city text not null default '',
  state text not null default '',
  start_date date not null,
  end_date date not null,
  aircraft text not null default '',
  organizer jsonb not null default '{}'::jsonb,       -- { name, phone, email }
  local_judge jsonb not null default '{}'::jsonb,     -- { name, phone, email, role }
  remote_judges jsonb not null default '[]'::jsonb,   -- [{ name, phone, email, role }]
  notes text not null default '',
  -- Next jumper number to hand out. Only ever increases, so removed numbers are never reused.
  next_jumper_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index events_created_by_idx on public.events (created_by);

-- Admins can manage every event; organizers only the ones they created (and only while they
-- still have a role).
create function public.can_manage_event(p_event_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (public.is_admin() or (e.created_by = (select auth.uid()) and public.app_role() is not null))
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- Skydivers
-- ---------------------------------------------------------------------------------------------

create table public.skydivers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  jumper_number integer not null check (jumper_number > 0),
  first_name text not null check (length(btrim(first_name)) > 0),
  last_name text not null check (length(btrim(last_name)) > 0),
  nick_name text not null default '',
  uspa_membership_id text not null check (uspa_membership_id ~ '^[0-9]{1,10}$'),
  membership_expiration date not null,
  uspa_license_number text not null default ''
    check (uspa_license_number = '' or uspa_license_number ~ '^[A-D]-[0-9]{1,7}$'),
  is_videographer boolean not null default false,
  added_at timestamptz not null default now(),
  unique (event_id, jumper_number),
  unique (event_id, uspa_membership_id)
);

-- Jumper numbers: when none is given, take the event's next number atomically (the UPDATE locks
-- the event row, so two organizers adding at once can't get the same number). When one is given
-- (importing existing data), keep it and move the counter past it.
create function public.assign_jumper_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if new.jumper_number is null then
    update public.events
       set next_jumper_number = next_jumper_number + 1
     where id = new.event_id
    returning next_jumper_number - 1 into n;
    new.jumper_number := n;
  else
    update public.events
       set next_jumper_number = greatest(next_jumper_number, new.jumper_number + 1)
     where id = new.event_id;
  end if;
  return new;
end
$$;

create trigger skydivers_assign_jumper_number
  before insert on public.skydivers
  for each row execute function public.assign_jumper_number();

-- ---------------------------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------------------------

create table public.records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  zone text not null check (zone in ('national', 'state', 'uspa-open-national')),
  state text not null default '',
  type text not null check (type in (
    'ws-lf-nogrip-horizontal',
    'ws-lf-nogrip-vertical',
    'ws-seq-lf-nogrip-horizontal',
    'ws-seq-lf-nogrip-vertical',
    'ws-lf-grip'
  )),
  -- Null only for records imported from before attempt dates existed.
  attempt_date date,
  viewpoint text not null default 'top-down' check (viewpoint in ('top-down', 'back-to-front')),
  skydiver_ids uuid[] not null default '{}',
  -- Formation points: [{ size, positions: { <skydiver id>: { row, col } } }]
  grids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (zone <> 'state' or state <> '')
);

create index records_event_id_idx on public.records (event_id);
create index skydivers_event_id_idx on public.skydivers (event_id);

-- Removing a skydiver from the pool also takes them off every record and every formation point.
create function public.remove_skydiver_from_records() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.records r
     set skydiver_ids = array_remove(r.skydiver_ids, old.id),
         grids = (
           select coalesce(jsonb_agg(g #- array['positions', old.id::text] order by ord), '[]'::jsonb)
             from jsonb_array_elements(r.grids) with ordinality as t(g, ord)
         )
   where r.event_id = old.event_id
     and old.id = any (r.skydiver_ids);
  return old;
end
$$;

create trigger skydivers_remove_from_records
  after delete on public.skydivers
  for each row execute function public.remove_skydiver_from_records();

-- ---------------------------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger records_set_updated_at before update on public.records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.skydivers enable row level security;
alter table public.records enable row level security;

create policy "Users read their own role; admins read all"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Event policies test the row's own created_by rather than calling can_manage_event(id): inside an
-- INSERT ... RETURNING, a lookup query can't see the row being inserted yet.
create policy "Admins and owners read events"
  on public.events for select to authenticated
  using (public.is_admin() or (created_by = (select auth.uid()) and public.app_role() is not null));

create policy "Admins and organizers create their own events"
  on public.events for insert to authenticated
  with check (public.can_create_events() and created_by = (select auth.uid()));

create policy "Admins and owners update events"
  on public.events for update to authenticated
  using (public.is_admin() or (created_by = (select auth.uid()) and public.app_role() is not null))
  with check (public.is_admin() or (created_by = (select auth.uid()) and public.app_role() is not null));

create policy "Admins and owners delete events"
  on public.events for delete to authenticated
  using (public.is_admin() or (created_by = (select auth.uid()) and public.app_role() is not null));

create policy "Admins and event owners manage skydivers"
  on public.skydivers for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "Admins and event owners manage records"
  on public.records for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- ---------------------------------------------------------------------------------------------
-- Grants (explicit; nothing is exposed automatically)
-- ---------------------------------------------------------------------------------------------

revoke all on public.user_roles, public.events, public.skydivers, public.records from anon, authenticated;

-- Roles are read-only through the API; admins manage them in the dashboard.
grant select on public.user_roles to authenticated;

-- Column lists keep id/owner/counters/timestamps out of the client's hands.
grant select, delete on public.events to authenticated;
grant insert (id, name, drop_zone, city, state, start_date, end_date, aircraft,
              organizer, local_judge, remote_judges, notes)
  on public.events to authenticated;
grant update (name, drop_zone, city, state, start_date, end_date, aircraft,
              organizer, local_judge, remote_judges, notes)
  on public.events to authenticated;

grant select, delete on public.skydivers to authenticated;
grant insert (id, event_id, jumper_number, first_name, last_name, nick_name, uspa_membership_id,
              membership_expiration, uspa_license_number, is_videographer)
  on public.skydivers to authenticated;
grant update (first_name, last_name, nick_name, uspa_membership_id, membership_expiration,
              uspa_license_number, is_videographer)
  on public.skydivers to authenticated;

grant select, delete on public.records to authenticated;
grant insert (id, event_id, zone, state, type, attempt_date, viewpoint, skydiver_ids, grids)
  on public.records to authenticated;
grant update (zone, state, type, attempt_date, viewpoint, skydiver_ids, grids)
  on public.records to authenticated;

-- Functions: only signed-in users may call the permission helpers; trigger functions need no grant.
revoke execute on function
  public.app_role(), public.is_admin(), public.can_create_events(), public.can_manage_event(uuid),
  public.assign_jumper_number(), public.remove_skydiver_from_records(), public.set_updated_at()
  from public, anon, authenticated;
grant execute on function
  public.app_role(), public.is_admin(), public.can_create_events(), public.can_manage_event(uuid)
  to authenticated;
