create type public.app_role as enum ('member','coach','pod_leader','admin','super_admin');

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  locale text not null default 'ar',
  units text not null default 'metric',
  timezone text not null default 'Africa/Cairo',
  onboarding_completed boolean not null default false,
  consent_at timestamptz,
  access_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','super_admin'))
$$;

-- PODS
create table public.pods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  leader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pods to authenticated;
grant all on public.pods to service_role;
alter table public.pods enable row level security;
create trigger trg_pods_updated before update on public.pods for each row execute function public.update_updated_at_column();

create table public.pod_members (
  pod_id uuid not null references public.pods(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pod_id, member_id)
);
grant select, insert, delete on public.pod_members to authenticated;
grant all on public.pod_members to service_role;
alter table public.pod_members enable row level security;

create table public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (coach_id, member_id)
);
grant select, insert, update, delete on public.coach_assignments to authenticated;
grant all on public.coach_assignments to service_role;
alter table public.coach_assignments enable row level security;

create or replace function public.manages_member(_manager uuid, _member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coach_assignments where coach_id = _manager and member_id = _member and active)
      or exists (select 1 from public.pods p join public.pod_members pm on pm.pod_id = p.id
                 where p.leader_id = _manager and pm.member_id = _member)
$$;

-- INVITES
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null default 'member',
  pod_id uuid references public.pods(id) on delete set null,
  coach_id uuid references public.profiles(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_email_idx on public.invites (lower(email));
grant select, insert, update on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;

-- AUDIT LOG (append-only)
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

-- POLICIES
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()) or public.manages_member(auth.uid(), id));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "admins grant non-admin roles" on public.user_roles for insert to authenticated
  with check ((public.is_admin(auth.uid()) and role in ('member','coach','pod_leader'))
              or public.has_role(auth.uid(),'super_admin'));
create policy "admins revoke non-admin roles" on public.user_roles for delete to authenticated
  using ((public.is_admin(auth.uid()) and role in ('member','coach','pod_leader'))
         or (public.has_role(auth.uid(),'super_admin') and user_id <> auth.uid()));

create policy "pods read" on public.pods for select to authenticated
  using (public.is_admin(auth.uid()) or leader_id = auth.uid()
         or exists (select 1 from public.pod_members pm where pm.pod_id = id and pm.member_id = auth.uid()));
create policy "pods admin write" on public.pods for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "pod members read" on public.pod_members for select to authenticated
  using (public.is_admin(auth.uid()) or member_id = auth.uid()
         or exists (select 1 from public.pods p where p.id = pod_id and p.leader_id = auth.uid()));
create policy "pod members admin write" on public.pod_members for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "coach assignments read" on public.coach_assignments for select to authenticated
  using (public.is_admin(auth.uid()) or coach_id = auth.uid() or member_id = auth.uid());
create policy "coach assignments admin write" on public.coach_assignments for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "invites admin read" on public.invites for select to authenticated using (public.is_admin(auth.uid()));
create policy "invites admin create" on public.invites for insert to authenticated
  with check (public.is_admin(auth.uid()) and (role in ('member','coach','pod_leader') or public.has_role(auth.uid(),'super_admin')));
create policy "invites admin update" on public.invites for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "audit admin read" on public.audit_log for select to authenticated using (public.is_admin(auth.uid()));

-- Members cannot flip their own access switch
create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.access_active is distinct from old.access_active and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change membership access';
  end if;
  if new.email is distinct from old.email and not public.is_admin(auth.uid()) then
    new.email := old.email;
  end if;
  return new;
end; $$;
create trigger trg_profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- Audit triggers
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'user_id'),
          case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return null;
end; $$;
create trigger audit_user_roles after insert or delete on public.user_roles for each row execute function public.audit_change();
create trigger audit_invites after insert or update on public.invites for each row execute function public.audit_change();
create trigger audit_coach_assignments after insert or update or delete on public.coach_assignments for each row execute function public.audit_change();

-- Invite-only signup: first user bootstraps as super admin
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype; first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  if not first_user then
    select * into inv from public.invites
      where lower(email) = lower(new.email) and accepted_at is null and revoked_at is null and expires_at > now()
      order by created_at desc limit 1;
    if inv.id is null then
      raise exception 'Prime Fitness is invite-only. No valid invitation for this email.';
    end if;
  end if;

  insert into public.profiles(id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'member');

  if first_user then
    insert into public.user_roles(user_id, role) values (new.id, 'super_admin');
  else
    if inv.role <> 'member' then
      insert into public.user_roles(user_id, role) values (new.id, inv.role) on conflict do nothing;
    end if;
    if inv.pod_id is not null then insert into public.pod_members(pod_id, member_id) values (inv.pod_id, new.id) on conflict do nothing; end if;
    if inv.coach_id is not null then insert into public.coach_assignments(coach_id, member_id) values (inv.coach_id, new.id) on conflict do nothing; end if;
    update public.invites set accepted_at = now() where id = inv.id;
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.audit_change() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;