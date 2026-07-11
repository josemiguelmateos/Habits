-- ============================================================
-- 0005 — Dieta semanal: plan de comidas por día + lista de la
-- compra auto-calculada del bruto para toda la semana.
-- Cada comida se aplica a un conjunto de días (dias smallint[]),
-- igual que la rutina referencia weekday. Los items estructurados
-- (nombre, cantidad, unidad) permiten agregar la lista de la compra.
-- ============================================================

create table public.diet_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  objetivo text,
  kcal integer,
  notas text,
  updated_at timestamptz not null default now()
);

create table public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dias smallint[] not null,          -- días (1=lunes..7=domingo) en los que toca
  slot text not null,                -- "Desayuno", "Comida", "Cena", "Snack"…
  orden integer not null default 0,  -- orden dentro del día
  descripcion text not null,
  created_at timestamptz not null default now()
);
create index diet_meals_user_idx on public.diet_meals (user_id);

create table public.diet_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.diet_meals(id) on delete cascade,
  nombre text not null,
  categoria text,
  cantidad numeric(9,2),   -- nullable: "verdura al gusto" no tiene cantidad
  unidad text,
  created_at timestamptz not null default now()
);
create index dmi_meal_idx on public.diet_meal_items (meal_id);
create index dmi_user_idx on public.diet_meal_items (user_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.diet_meta enable row level security;

create policy "diet_meta_select_own" on public.diet_meta
  for select using (auth.uid() = user_id);
create policy "diet_meta_insert_own" on public.diet_meta
  for insert with check (auth.uid() = user_id);
create policy "diet_meta_update_own" on public.diet_meta
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diet_meta_delete_own" on public.diet_meta
  for delete using (auth.uid() = user_id);

alter table public.diet_meals enable row level security;

create policy "diet_meals_select_own" on public.diet_meals
  for select using (auth.uid() = user_id);
create policy "diet_meals_insert_own" on public.diet_meals
  for insert with check (auth.uid() = user_id);
create policy "diet_meals_update_own" on public.diet_meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diet_meals_delete_own" on public.diet_meals
  for delete using (auth.uid() = user_id);

alter table public.diet_meal_items enable row level security;

create policy "dmi_select_own" on public.diet_meal_items
  for select using (auth.uid() = user_id);
create policy "dmi_insert_own" on public.diet_meal_items
  for insert with check (auth.uid() = user_id);
create policy "dmi_update_own" on public.diet_meal_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dmi_delete_own" on public.diet_meal_items
  for delete using (auth.uid() = user_id);

create trigger diet_meta_updated_at before update on public.diet_meta
  for each row execute function public.set_updated_at();
