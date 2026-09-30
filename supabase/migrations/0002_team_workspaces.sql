-- Team workspaces, membership, invitations, and tenant-scoped classroom data.
-- Existing sample rows remain visible in a read-only demo workspace.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('owner', 'admin', 'teacher')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  role text not null default 'teacher' check (role = 'teacher'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, is_demo)
values ('d2000000-0000-0000-0000-000000000001', 'Sunshine class · Demo', true)
on conflict (id) do nothing;

alter table public.students add column if not exists organization_id uuid;
update public.students set organization_id = 'd2000000-0000-0000-0000-000000000001' where organization_id is null;
alter table public.students alter column organization_id set not null;
alter table public.students add constraint students_organization_id_fkey foreign key (organization_id) references public.organizations(id);
alter table public.students add constraint students_organization_id_id_key unique (organization_id, id);

alter table public.attendance add column if not exists organization_id uuid;
update public.attendance a set organization_id = s.organization_id from public.students s where a.student_id = s.id and a.organization_id is null;
alter table public.attendance alter column organization_id set not null;
alter table public.attendance drop constraint if exists attendance_student_id_fkey;
alter table public.attendance add constraint attendance_student_organization_fkey foreign key (organization_id, student_id) references public.students(organization_id, id) on delete cascade;
alter table public.attendance add constraint attendance_organization_student_date_key unique (organization_id, student_id, record_date);

alter table public.meal_records add column if not exists organization_id uuid;
update public.meal_records m set organization_id = s.organization_id from public.students s where m.student_id = s.id and m.organization_id is null;
alter table public.meal_records alter column organization_id set not null;
alter table public.meal_records drop constraint if exists meal_records_student_id_fkey;
alter table public.meal_records add constraint meal_records_student_organization_fkey foreign key (organization_id, student_id) references public.students(organization_id, id) on delete cascade;
alter table public.meal_records add constraint meal_records_organization_student_date_meal_key unique (organization_id, student_id, record_date, meal_type);

alter table public.reading_lessons add column if not exists organization_id uuid;
update public.reading_lessons r set organization_id = s.organization_id from public.students s where r.student_id = s.id and r.organization_id is null;
alter table public.reading_lessons alter column organization_id set not null;
alter table public.reading_lessons drop constraint if exists reading_lessons_student_id_fkey;
alter table public.reading_lessons add constraint reading_lessons_student_organization_fkey foreign key (organization_id, student_id) references public.students(organization_id, id) on delete cascade;
alter table public.reading_lessons add constraint reading_organization_student_date_key unique (organization_id, student_id, record_date);

alter table public.audit_logs add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
update public.audit_logs set organization_id = 'd2000000-0000-0000-0000-000000000001' where organization_id is null;

create index if not exists students_organization_name_idx on public.students (organization_id, name);
create index if not exists attendance_organization_date_idx on public.attendance (organization_id, record_date);
create index if not exists meals_organization_date_idx on public.meal_records (organization_id, record_date);
create index if not exists reading_organization_date_idx on public.reading_lessons (organization_id, record_date);
create index if not exists organization_members_user_idx on public.organization_members (user_id, organization_id);

create or replace function public.is_workspace_member(target_organization uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_organization uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_demo_workspace(target_organization uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = target_organization and o.is_demo = true
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select
  using (is_demo or public.is_workspace_member(id));

drop policy if exists organization_members_read on public.organization_members;
create policy organization_members_read on public.organization_members for select
  using (user_id = auth.uid() or public.is_workspace_admin(organization_id));

drop policy if exists organization_invites_read on public.organization_invites;
create policy organization_invites_read on public.organization_invites for select
  using (public.is_workspace_admin(organization_id));

-- These RPCs are the only supported way to create workspaces or memberships.
create or replace function public.list_workspaces()
returns table (workspace_id uuid, workspace_name text, is_demo boolean, role text)
language sql stable security definer
set search_path = ''
as $$
  select o.id, o.name, o.is_demo, coalesce(m.role, 'demo')
  from public.organizations o
  left join public.organization_members m
    on m.organization_id = o.id and m.user_id = auth.uid()
  where o.is_demo = true or m.user_id is not null
  order by o.is_demo desc, o.name;
$$;

create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_organization uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to create a workspace'; end if;
  if workspace_name is null or length(trim(workspace_name)) not between 2 and 80 then
    raise exception 'Workspace name must be between 2 and 80 characters';
  end if;
  insert into public.organizations (name) values (trim(workspace_name)) returning id into new_organization;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_organization, auth.uid(), 'owner');
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    values (new_organization, auth.uid(), 'workspace_created', 'organization', new_organization, '{}'::jsonb);
  return new_organization;
end;
$$;

create or replace function public.list_workspace_members(target_organization uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_member(target_organization) then
    raise exception 'You are not a member of this workspace';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.joined_at
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at;
end;
$$;

create or replace function public.create_workspace_invite(target_organization uuid, invite_email text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  invite_token uuid;
  normalized_email text := lower(trim(invite_email));
begin
  if not public.is_workspace_admin(target_organization) then
    raise exception 'Only workspace owners and admins can invite teammates';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization and lower(u.email) = normalized_email
  ) then raise exception 'That person is already on this team'; end if;

  insert into public.organization_invites (organization_id, invited_email, invited_by)
    values (target_organization, normalized_email, auth.uid())
    returning token into invite_token;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    values (target_organization, auth.uid(), 'teammate_invited', 'organization_invite', null,
      jsonb_build_object('role', 'teacher'));
  return invite_token::text;
end;
$$;

create or replace function public.accept_workspace_invite(invite_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  invitation public.organization_invites%rowtype;
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Sign in before accepting a team invitation'; end if;
  if invite_token is null or invite_token !~* '^[0-9a-f-]{36}$' then raise exception 'This invitation link is not valid'; end if;
  select * into invitation
  from public.organization_invites i
  where i.token = invite_token::uuid and i.accepted_at is null and i.expires_at > now()
  for update;
  if not found then raise exception 'This invitation has expired or was already used'; end if;
  if signed_in_email = '' or signed_in_email <> lower(invitation.invited_email) then
    raise exception 'Sign in with the email address this invitation was sent to';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
    values (invitation.organization_id, auth.uid(), invitation.role)
    on conflict (organization_id, user_id) do nothing;
  update public.organization_invites set accepted_at = now() where id = invitation.id;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    values (invitation.organization_id, auth.uid(), 'teammate_joined', 'organization_member', auth.uid(), '{}'::jsonb);
  return invitation.organization_id;
end;
$$;

create or replace function public.remove_workspace_member(target_organization uuid, target_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  target_role text;
  actor_role text;
begin
  select m.role into actor_role from public.organization_members m
    where m.organization_id = target_organization and m.user_id = auth.uid();
  select m.role into target_role from public.organization_members m
    where m.organization_id = target_organization and m.user_id = target_user;
  if actor_role is null or actor_role not in ('owner', 'admin') or target_role is null then
    raise exception 'You cannot remove this teammate';
  end if;
  if target_role = 'owner' or (target_role = 'admin' and actor_role <> 'owner') then
    raise exception 'Only an owner can remove an admin, and owners cannot be removed';
  end if;
  delete from public.organization_members
    where organization_id = target_organization and user_id = target_user;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    values (target_organization, auth.uid(), 'teammate_removed', 'organization_member', target_user, '{}'::jsonb);
end;
$$;

create or replace function public.audit_classroom_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  target_entity uuid;
  event_name text;
begin
  if TG_OP = 'DELETE' then
    target_organization := OLD.organization_id;
    target_entity := OLD.id;
  else
    target_organization := NEW.organization_id;
    target_entity := NEW.id;
  end if;
  event_name := case
    when TG_TABLE_NAME = 'students' and TG_OP = 'INSERT' then 'student_created'
    when TG_TABLE_NAME = 'students' and TG_OP = 'UPDATE' then 'student_updated'
    when TG_TABLE_NAME = 'students' and TG_OP = 'DELETE' then 'student_deleted'
    when TG_TABLE_NAME = 'attendance' then 'attendance_marked'
    when TG_TABLE_NAME = 'meal_records' then 'meal_recorded'
    when TG_TABLE_NAME = 'reading_lessons' then 'reading_lesson_recorded'
    else lower(TG_OP) || '_' || TG_TABLE_NAME
  end;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    values (target_organization, auth.uid(), event_name, TG_TABLE_NAME, target_entity,
      jsonb_build_object('operation', lower(TG_OP)));
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists students_audit_change on public.students;
create trigger students_audit_change after insert or update or delete on public.students
  for each row execute function public.audit_classroom_change();
drop trigger if exists attendance_audit_change on public.attendance;
create trigger attendance_audit_change after insert or update or delete on public.attendance
  for each row execute function public.audit_classroom_change();
drop trigger if exists meals_audit_change on public.meal_records;
create trigger meals_audit_change after insert or update or delete on public.meal_records
  for each row execute function public.audit_classroom_change();
drop trigger if exists reading_audit_change on public.reading_lessons;
create trigger reading_audit_change after insert or update or delete on public.reading_lessons
  for each row execute function public.audit_classroom_change();

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.is_demo_workspace(uuid) from public, anon;
revoke all on function public.list_workspaces() from public;
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.list_workspace_members(uuid) from public, anon;
revoke all on function public.create_workspace_invite(uuid, text) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_demo_workspace(uuid) to anon, authenticated;
grant execute on function public.list_workspaces() to anon, authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

drop policy if exists "students_v1_read" on public.students;
drop policy if exists "students_v1_write" on public.students;
create policy students_workspace_read on public.students for select
  using (public.is_demo_workspace(organization_id) or public.is_workspace_member(organization_id));
create policy students_workspace_insert on public.students for insert
  with check (public.is_workspace_member(organization_id));
create policy students_workspace_update on public.students for update
  using (public.is_workspace_member(organization_id)) with check (public.is_workspace_member(organization_id));
create policy students_workspace_delete on public.students for delete
  using (public.is_workspace_member(organization_id));

drop policy if exists "attendance_v1_read" on public.attendance;
drop policy if exists "attendance_v1_write" on public.attendance;
create policy attendance_workspace_read on public.attendance for select
  using (public.is_demo_workspace(organization_id) or public.is_workspace_member(organization_id));
create policy attendance_workspace_insert on public.attendance for insert
  with check (public.is_workspace_member(organization_id));
create policy attendance_workspace_update on public.attendance for update
  using (public.is_workspace_member(organization_id)) with check (public.is_workspace_member(organization_id));
create policy attendance_workspace_delete on public.attendance for delete
  using (public.is_workspace_member(organization_id));

drop policy if exists "meal_records_v1_read" on public.meal_records;
drop policy if exists "meal_records_v1_write" on public.meal_records;
create policy meals_workspace_read on public.meal_records for select
  using (public.is_demo_workspace(organization_id) or public.is_workspace_member(organization_id));
create policy meals_workspace_insert on public.meal_records for insert
  with check (public.is_workspace_member(organization_id));
create policy meals_workspace_update on public.meal_records for update
  using (public.is_workspace_member(organization_id)) with check (public.is_workspace_member(organization_id));
create policy meals_workspace_delete on public.meal_records for delete
  using (public.is_workspace_member(organization_id));

drop policy if exists "reading_lessons_v1_read" on public.reading_lessons;
drop policy if exists "reading_lessons_v1_write" on public.reading_lessons;
create policy reading_workspace_read on public.reading_lessons for select
  using (public.is_demo_workspace(organization_id) or public.is_workspace_member(organization_id));
create policy reading_workspace_insert on public.reading_lessons for insert
  with check (public.is_workspace_member(organization_id));
create policy reading_workspace_update on public.reading_lessons for update
  using (public.is_workspace_member(organization_id)) with check (public.is_workspace_member(organization_id));
create policy reading_workspace_delete on public.reading_lessons for delete
  using (public.is_workspace_member(organization_id));

drop policy if exists "audit_logs_v1_read" on public.audit_logs;
drop policy if exists "audit_logs_v1_write" on public.audit_logs;
create policy audit_logs_workspace_read on public.audit_logs for select
  using (public.is_workspace_member(organization_id));

-- Audit rows are append-only and are written by the trusted database triggers/RPCs.
revoke insert, update, delete on public.audit_logs from anon, authenticated;

grant select on public.organizations, public.organization_members, public.organization_invites to authenticated;
grant select on public.organizations to anon;
