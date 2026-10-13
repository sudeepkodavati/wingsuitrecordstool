-- Share links: read-only access to one event for participants who don't sign in.
--
-- An event is shared while it has a share_token (a random UUID). Anonymous visitors can only call
-- get_shared_event(token), which returns a hand-picked subset of fields: no USPA IDs, licenses,
-- membership dates, phone numbers, emails or notes. They still have no access to any table.

alter table public.events add column share_token uuid unique;

comment on column public.events.share_token is
  'Non-null while the event is shared. Replacing it invalidates the old link.';

-- Turn sharing on (always with a fresh token, so this also replaces an existing link) or off.
-- Only admins and the event's owner may do this.
create function public.set_event_sharing(p_event_id uuid, p_enabled boolean) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t uuid;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed to change sharing for this event' using errcode = '42501';
  end if;
  update public.events
     set share_token = case when p_enabled then gen_random_uuid() else null end
   where id = p_event_id
  returning share_token into t;
  return t;
end
$$;

-- The participant view. Returns null for an unknown, malformed or revoked token.
create function public.get_shared_event(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'name', e.name,
      'dropZone', e.drop_zone,
      'city', e.city,
      'state', e.state,
      'startDate', e.start_date,
      'endDate', e.end_date,
      'organizerName', coalesce(e.organizer ->> 'name', ''),
      'localJudge', jsonb_build_object(
        'name', coalesce(e.local_judge ->> 'name', ''),
        'role', coalesce(e.local_judge ->> 'role', '')
      ),
      'remoteJudges', coalesce((
        select jsonb_agg(jsonb_build_object('name', coalesce(j ->> 'name', ''), 'role', coalesce(j ->> 'role', '')))
          from jsonb_array_elements(e.remote_judges) as j
      ), '[]'::jsonb)
    ),
    'skydivers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'jumperNumber', s.jumper_number,
               'firstName', s.first_name,
               'lastName', s.last_name,
               'isVideographer', s.is_videographer
             ) order by s.jumper_number)
        from public.skydivers s
       where s.event_id = e.id
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'zone', r.zone,
               'state', r.state,
               'type', r.type,
               'attemptDate', r.attempt_date,
               'viewpoint', r.viewpoint,
               'skydiverIds', to_jsonb(r.skydiver_ids),
               'grids', r.grids
             ) order by r.created_at)
        from public.records r
       where r.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.share_token is not null
    and e.share_token::text = lower(btrim(p_token))
$$;

revoke execute on function public.set_event_sharing(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_event_sharing(uuid, boolean) to authenticated;

revoke execute on function public.get_shared_event(text) from public, anon, authenticated;
grant execute on function public.get_shared_event(text) to anon, authenticated;
