-- ============================================================
-- 0001 — Esquema inicial completo con RLS
-- App personal de hábitos: entrenamiento, hidratación, dieta y sueño
-- Convención: weekday smallint 1-7 (1=lunes … 7=domingo, ISO)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- PROFILES (id = auth.uid)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  objetivo text not null default 'Hipertrofia',
  fecha_inicio date not null default current_date,
  water_goal_ml integer not null default 2500,
  sleep_goal_hours numeric(3,1) not null default 7,
  theme text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- EXERCISES
-- ------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  grupo_muscular text,
  notas_tecnica text,
  search_hint_en text,
  photo_url text,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_user_idx on public.exercises (user_id);

-- ------------------------------------------------------------
-- ROUTINE_DAYS
-- ------------------------------------------------------------
create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  titulo text not null,
  created_at timestamptz not null default now(),
  unique (user_id, weekday)
);

-- ------------------------------------------------------------
-- ROUTINE_DAY_EXERCISES
-- ------------------------------------------------------------
create table public.routine_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_day_id uuid not null references public.routine_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  orden integer not null default 0,
  series integer not null default 4,
  reps text not null default '',     -- TEXTO a propósito: hay esquemas tipo "12+12"
  peso numeric(6,2),                 -- KGS editable, arranca null
  descanso_seg integer not null default 60,
  notas text,
  created_at timestamptz not null default now()
);
create index rde_day_idx on public.routine_day_exercises (routine_day_id);
create index rde_user_idx on public.routine_day_exercises (user_id);

-- ------------------------------------------------------------
-- SET_LOGS (historial de progresión de cargas)
-- ------------------------------------------------------------
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  fecha date not null default current_date,
  serie integer not null,
  reps_hechas integer,
  peso_usado numeric(6,2),
  created_at timestamptz not null default now()
);
create index set_logs_user_ex_fecha_idx on public.set_logs (user_id, exercise_id, fecha);

-- ------------------------------------------------------------
-- CARDIO_SESSIONS
-- ------------------------------------------------------------
create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  duracion_min integer,
  momento text,          -- "post-entreno" / "ayunas"
  tipo text,
  metodo text,
  zona_velocidad text,
  notas text,
  created_at timestamptz not null default now()
);
create index cardio_user_idx on public.cardio_sessions (user_id);

-- ------------------------------------------------------------
-- DAILY_LOG (una fila por usuario y día)
-- ------------------------------------------------------------
create table public.daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null default current_date,
  exercise_done boolean not null default false,
  diet_done boolean not null default false,
  sleep_done boolean not null default false,
  hydration_done boolean not null default false,
  water_ml integer not null default 0,
  sleep_hours numeric(3,1),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fecha)
);
create index daily_log_user_fecha_idx on public.daily_log (user_id, fecha);

-- ============================================================
-- RLS: activado en TODAS las tablas, políticas auth.uid() = user_id
-- ============================================================

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

alter table public.exercises enable row level security;

create policy "exercises_select_own" on public.exercises
  for select using (auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises
  for delete using (auth.uid() = user_id);

alter table public.routine_days enable row level security;

create policy "routine_days_select_own" on public.routine_days
  for select using (auth.uid() = user_id);
create policy "routine_days_insert_own" on public.routine_days
  for insert with check (auth.uid() = user_id);
create policy "routine_days_update_own" on public.routine_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routine_days_delete_own" on public.routine_days
  for delete using (auth.uid() = user_id);

alter table public.routine_day_exercises enable row level security;

create policy "rde_select_own" on public.routine_day_exercises
  for select using (auth.uid() = user_id);
create policy "rde_insert_own" on public.routine_day_exercises
  for insert with check (auth.uid() = user_id);
create policy "rde_update_own" on public.routine_day_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rde_delete_own" on public.routine_day_exercises
  for delete using (auth.uid() = user_id);

alter table public.set_logs enable row level security;

create policy "set_logs_select_own" on public.set_logs
  for select using (auth.uid() = user_id);
create policy "set_logs_insert_own" on public.set_logs
  for insert with check (auth.uid() = user_id);
create policy "set_logs_update_own" on public.set_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "set_logs_delete_own" on public.set_logs
  for delete using (auth.uid() = user_id);

alter table public.cardio_sessions enable row level security;

create policy "cardio_select_own" on public.cardio_sessions
  for select using (auth.uid() = user_id);
create policy "cardio_insert_own" on public.cardio_sessions
  for insert with check (auth.uid() = user_id);
create policy "cardio_update_own" on public.cardio_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cardio_delete_own" on public.cardio_sessions
  for delete using (auth.uid() = user_id);

alter table public.daily_log enable row level security;

create policy "daily_log_select_own" on public.daily_log
  for select using (auth.uid() = user_id);
create policy "daily_log_insert_own" on public.daily_log
  for insert with check (auth.uid() = user_id);
create policy "daily_log_update_own" on public.daily_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_log_delete_own" on public.daily_log
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger daily_log_updated_at before update on public.daily_log
  for each row execute function public.set_updated_at();
