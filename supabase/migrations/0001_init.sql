create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  age int not null check (age in (5, 6)),
  group_name text not null default 'K1-A',
  notes text,
  reading_level_suggestion text,
  suggestion_source text,
  suggestion_confidence numeric,
  suggestion_review_status text default 'unreviewed',
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  student_id uuid not null references students(id) on delete cascade,
  record_date date not null default current_date,
  status text not null default 'present' check (status in ('present','absent','late','excused')),
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, record_date)
);

create table if not exists meal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  student_id uuid not null references students(id) on delete cascade,
  record_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch')),
  status text not null default 'pending' check (status in ('completed','skipped','partial','pending')),
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, record_date, meal_type)
);

create table if not exists reading_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  student_id uuid not null references students(id) on delete cascade,
  record_date date not null default current_date,
  duration_minutes int not null default 30 check (duration_minutes >= 0),
  status text not null default 'incomplete' check (status in ('completed','incomplete')),
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, record_date)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table students enable row level security;
drop policy if exists "students_v1_read" on students;
create policy "students_v1_read" on students for select using (true);
drop policy if exists "students_v1_write" on students;
create policy "students_v1_write" on students for all using (true) with check (true);

alter table attendance enable row level security;
drop policy if exists "attendance_v1_read" on attendance;
create policy "attendance_v1_read" on attendance for select using (true);
drop policy if exists "attendance_v1_write" on attendance;
create policy "attendance_v1_write" on attendance for all using (true) with check (true);

alter table meal_records enable row level security;
drop policy if exists "meal_records_v1_read" on meal_records;
create policy "meal_records_v1_read" on meal_records for select using (true);
drop policy if exists "meal_records_v1_write" on meal_records;
create policy "meal_records_v1_write" on meal_records for all using (true) with check (true);

alter table reading_lessons enable row level security;
drop policy if exists "reading_lessons_v1_read" on reading_lessons;
create policy "reading_lessons_v1_read" on reading_lessons for select using (true);
drop policy if exists "reading_lessons_v1_write" on reading_lessons;
create policy "reading_lessons_v1_write" on reading_lessons for all using (true) with check (true);

alter table audit_logs enable row level security;
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into students (id, name, age, group_name, notes, reading_level_suggestion, suggestion_source, suggestion_confidence, suggestion_review_status) values
  ('a1000000-0000-0000-0000-000000000001', 'Emma Chen', 5, 'K1-A', 'Enjoys storytime', 'Level A', 'age-based-rule', 0.85, 'unreviewed'),
  ('a1000000-0000-0000-0000-000000000002', 'Lucas Wong', 6, 'K2-B', 'Advanced reader', 'Level B', 'age-based-rule', 0.90, 'reviewed'),
  ('a1000000-0000-0000-0000-000000000003', 'Aisha Rahman', 5, 'K1-A', 'Loves picture books', 'Level A', 'age-based-rule', 0.80, 'unreviewed'),
  ('a1000000-0000-0000-0000-000000000004', 'Noah Tan', 6, 'K2-B', 'Active learner', 'Level B', 'age-based-rule', 0.88, 'unreviewed'),
  ('a1000000-0000-0000-0000-000000000005', 'Mia Kumar', 5, 'K1-A', 'Shy but curious', 'Level A', 'age-based-rule', 0.82, 'unreviewed')
on conflict (id) do nothing;

insert into attendance (student_id, record_date, status, notes) values
  ('a1000000-0000-0000-0000-000000000001', current_date, 'present', null),
  ('a1000000-0000-0000-0000-000000000002', current_date, 'absent', 'Sick - parent called in'),
  ('a1000000-0000-0000-0000-000000000003', current_date, 'present', null),
  ('a1000000-0000-0000-0000-000000000004', current_date, 'late', 'Arrived 9:15am'),
  ('a1000000-0000-0000-0000-000000000005', current_date, 'present', null),
  ('a1000000-0000-0000-0000-000000000001', current_date - 1, 'present', null),
  ('a1000000-0000-0000-0000-000000000002', current_date - 1, 'present', null),
  ('a1000000-0000-0000-0000-000000000003', current_date - 1, 'absent', 'Family trip'),
  ('a1000000-0000-0000-0000-000000000004', current_date - 1, 'present', null),
  ('a1000000-0000-0000-0000-000000000005', current_date - 1, 'present', null)
on conflict do nothing;

insert into meal_records (student_id, record_date, meal_type, status, notes) values
  ('a1000000-0000-0000-0000-000000000001', current_date, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000001', current_date, 'lunch', 'completed', null),
  ('a1000000-0000-0000-0000-000000000003', current_date, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000003', current_date, 'lunch', 'partial', 'Only ate half'),
  ('a1000000-0000-0000-0000-000000000004', current_date, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000004', current_date, 'lunch', 'completed', null),
  ('a1000000-0000-0000-0000-000000000005', current_date, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000005', current_date, 'lunch', 'completed', null),
  ('a1000000-0000-0000-0000-000000000001', current_date - 1, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000001', current_date - 1, 'lunch', 'completed', null),
  ('a1000000-0000-0000-0000-000000000002', current_date - 1, 'breakfast', 'completed', null),
  ('a1000000-0000-0000-0000-000000000002', current_date - 1, 'lunch', 'skipped', null)
on conflict do nothing;

insert into reading_lessons (student_id, record_date, status, duration_minutes, notes) values
  ('a1000000-0000-0000-0000-000000000001', current_date, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000003', current_date, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000004', current_date, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000005', current_date, 'incomplete', 15, 'Lost focus after 15 min'),
  ('a1000000-0000-0000-0000-000000000001', current_date - 1, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000002', current_date - 1, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000003', current_date - 1, 'incomplete', 0, 'Absent'),
  ('a1000000-0000-0000-0000-000000000004', current_date - 1, 'completed', 30, null),
  ('a1000000-0000-0000-0000-000000000005', current_date - 1, 'completed', 30, null)
on conflict do nothing;

insert into audit_logs (id, action, entity_type, entity_id, details) values
  ('b1000000-0000-0000-0000-000000000001', 'attendance_marked', 'attendance', 'a1000000-0000-0000-0000-000000000001', '{"status": "present"}'),
  ('b1000000-0000-0000-0000-000000000002', 'meal_completed', 'meal_records', null, '{"student": "Emma Chen", "meal": "breakfast"}'),
  ('b1000000-0000-0000-0000-000000000003', 'reading_completed', 'reading_lessons', 'a1000000-0000-0000-0000-000000000001', '{"duration": 30}')
on conflict (id) do nothing;