-- ============================================================
-- 0003 — Registro diario por ejercicio (kg y notas por fecha)
-- Para el panel del calendario: cada día concreto guarda el peso
-- que se pudo mover y una nota por ejercicio.
-- ============================================================

create table public.exercise_day_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  fecha date not null,
  peso numeric(6,2),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id, fecha)
);
create index edl_user_fecha_idx on public.exercise_day_logs (user_id, fecha);
create index edl_user_ex_idx on public.exercise_day_logs (user_id, exercise_id);

alter table public.exercise_day_logs enable row level security;

create policy "edl_select_own" on public.exercise_day_logs
  for select using (auth.uid() = user_id);
create policy "edl_insert_own" on public.exercise_day_logs
  for insert with check (auth.uid() = user_id);
create policy "edl_update_own" on public.exercise_day_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "edl_delete_own" on public.exercise_day_logs
  for delete using (auth.uid() = user_id);

create trigger edl_updated_at before update on public.exercise_day_logs
  for each row execute function public.set_updated_at();
