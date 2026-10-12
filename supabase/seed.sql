-- LOCAL DEVELOPMENT ONLY. Runs on `supabase start` / `supabase db reset` against the local stack;
-- it is never applied to the hosted project. Creates two test accounts:
--   admin@wingsuit.test     / local-dev-password   (role: admin)
--   organizer@wingsuit.test / local-dev-password   (role: organizer)

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-00000000a001'::uuid, 'admin@wingsuit.test', 'admin', 'Local Admin'),
      ('00000000-0000-0000-0000-00000000a002'::uuid, 'organizer@wingsuit.test', 'organizer', 'Local Organizer')
    ) as t(id, email, role, display_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
    insert into public.user_roles (user_id, role, display_name) values (u.id, u.role, u.display_name);
  end loop;
end
$$;
