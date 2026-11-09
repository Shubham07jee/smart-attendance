-- Smart Attendance schema starter for Supabase.
-- Run in Supabase SQL Editor. All tenant-owned rows are scoped to auth.uid().

create extension if not exists pgcrypto;

create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Teacher',
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  full_name text not null,
  roll_number text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id, roll_number)
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  session_date date not null default current_date,
  token_hash text not null,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete set null,
  attendance_date date not null default current_date,
  status text not null check (status in ('Present','Absent','Late','Excused')),
  source text not null default 'manual' check (source in ('manual','qr')),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date, class_id)
);

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid references public.attendance_records(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_teacher_class on public.students(teacher_id, class_id);
create index if not exists idx_attendance_teacher_date on public.attendance_records(teacher_id, attendance_date);
create index if not exists idx_sessions_expiry on public.attendance_sessions(expires_at);

alter table public.teacher_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_audit_logs enable row level security;

create policy "Teachers manage own profile" on public.teacher_profiles
for all using (id = auth.uid()) with check (id = auth.uid());

create policy "Teachers manage own classes" on public.classes
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "Teachers manage own students" on public.students
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "Teachers manage own sessions" on public.attendance_sessions
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "Teachers manage own attendance" on public.attendance_records
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "Teachers read own audit logs" on public.attendance_audit_logs
for select using (teacher_id = auth.uid());

create policy "Teachers add own audit logs" on public.attendance_audit_logs
for insert with check (teacher_id = auth.uid());

-- IMPORTANT:
-- Do not put the Supabase service_role/secret key in frontend environment variables.
-- QR check-in should be implemented through a trusted Edge Function/RPC with token
-- hashing, expiry validation, rate limiting, and server-side identity checks.
