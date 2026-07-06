-- ============================================================
-- 0004 — Modo amigos: grupos con código de invitación y
-- leaderboard de cumplimiento agregado.
-- Solo se comparte lo agregado (puntos, rachas, días perfectos,
-- nivel); NUNCA notas, comidas ni detalles.
-- ============================================================

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index gm_user_idx on public.group_members (user_id);
create index gm_group_idx on public.group_members (group_id);

-- Instantánea agregada que cada usuario publica de sí mismo.
-- La calcula el cliente con la misma lógica (puntos/rachas) de la app.
create table public.member_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  puntos_semana integer not null default 0,
  racha_ejercicio integer not null default 0,
  dias_perfectos integer not null default 0,
  nivel integer not null default 1,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Helpers SECURITY DEFINER: evitan la recursión de RLS al
-- consultar group_members desde sus propias políticas.
-- ------------------------------------------------------------
create or replace function public.my_group_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select group_id from group_members where user_id = auth.uid()
$$;

create or replace function public.fellow_member_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select distinct gm2.user_id
  from group_members gm1
  join group_members gm2 on gm1.group_id = gm2.group_id
  where gm1.user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.groups enable row level security;

create policy "groups_select_member" on public.groups
  for select using (id in (select public.my_group_ids()));
create policy "groups_delete_creator" on public.groups
  for delete using (created_by = auth.uid());

alter table public.group_members enable row level security;

create policy "gm_select_same_group" on public.group_members
  for select using (group_id in (select public.my_group_ids()));
create policy "gm_delete_own" on public.group_members
  for delete using (user_id = auth.uid());
-- inserts SOLO vía RPC (create_group / join_group)

alter table public.member_stats enable row level security;

create policy "ms_select_own_or_fellow" on public.member_stats
  for select using (
    user_id = auth.uid() or user_id in (select public.fellow_member_ids())
  );
create policy "ms_insert_own" on public.member_stats
  for insert with check (user_id = auth.uid());
create policy "ms_update_own" on public.member_stats
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- RPCs: crear grupo (genera código) y unirse por código
-- ------------------------------------------------------------
create or replace function public.create_group(p_nombre text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_codigo text;
  v_group groups%rowtype;
  v_intentos int := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El grupo necesita un nombre';
  end if;
  loop
    -- 6 caracteres, alfabeto sin ambiguos (sin 0/O ni 1/I)
    select string_agg(
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32))::int + 1, 1),
      ''
    ) into v_codigo from generate_series(1, 6);
    begin
      insert into groups (nombre, codigo, created_by)
      values (trim(p_nombre), v_codigo, auth.uid())
      returning * into v_group;
      exit;
    exception when unique_violation then
      v_intentos := v_intentos + 1;
      if v_intentos > 5 then raise; end if;
    end;
  end loop;
  insert into group_members (group_id, user_id) values (v_group.id, auth.uid());
  return json_build_object(
    'id', v_group.id, 'nombre', v_group.nombre, 'codigo', v_group.codigo
  );
end;
$$;

create or replace function public.join_group(p_codigo text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_group groups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  select * into v_group from groups where codigo = upper(trim(p_codigo));
  if not found then
    raise exception 'Código no válido';
  end if;
  insert into group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return json_build_object(
    'id', v_group.id, 'nombre', v_group.nombre, 'codigo', v_group.codigo
  );
end;
$$;

revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
