-- ============================================================
--  Cargar Inventario WT  ·  Setup de base compartida (multiusuario)
--  Proyecto: vkqsmwbhwekfwmdzihjj
--  Cómo correrlo: Supabase → tu proyecto → SQL Editor → New query
--  → pega TODO esto → RUN.  (Si el proyecto está "Paused", primero
--  pulsa "Restore project" y espera ~1 min.)
-- ============================================================

-- 1) Tabla maestra de inventario (una fila por SKU) -----------
create table if not exists public.wt_inventory (
  sku        text primary key,
  upc        text,
  brand      text,
  style      text,
  color      text,
  cc         text,           -- código de color
  size       text,
  cat        text,           -- tipo (Polo, T-Shirt…)
  gender     text,
  qty        integer not null default 0,
  cost       numeric(10,2) default 0,
  img        text,
  title      text,
  updated_at timestamptz not null default now()
);

create index if not exists wt_inventory_upc_idx on public.wt_inventory (upc);

-- 2) Bitácora de movimientos (auditoría entrada/salida) -------
create table if not exists public.wt_movements (
  id     bigserial primary key,
  sku    text,
  delta  integer not null,
  kind   text,               -- entrada | salida | ajuste | nuevo | upc
  who    text,               -- nombre de quien lo hizo (desde el móvil)
  ts     timestamptz not null default now()
);

-- 3) Función atómica: sumar/restar cantidad sin condiciones de
--    carrera (clave para que varias personas carguen a la vez)
create or replace function public.wt_adjust_qty(
  p_sku text, p_delta integer, p_kind text default 'ajuste', p_who text default null
) returns integer
language plpgsql
security definer
as $$
declare new_qty integer;
begin
  update public.wt_inventory
     set qty = greatest(0, qty + p_delta), updated_at = now()
   where sku = p_sku
   returning qty into new_qty;
  if new_qty is null then
    raise exception 'SKU % no existe', p_sku;
  end if;
  insert into public.wt_movements(sku, delta, kind, who) values (p_sku, p_delta, p_kind, p_who);
  return new_qty;
end;
$$;

-- 4) Seguridad de acceso (RLS) --------------------------------
--    Herramienta interna: se permite acceso con la clave pública
--    (anon) para que funcione desde el móvil sin login. El acceso
--    real se protege con un PIN en la app. Súbelo a login por
--    usuario cuando quieras endurecerlo.
alter table public.wt_inventory enable row level security;
alter table public.wt_movements enable row level security;

drop policy if exists wt_inv_all on public.wt_inventory;
create policy wt_inv_all on public.wt_inventory
  for all to anon, authenticated using (true) with check (true);

drop policy if exists wt_mov_ins on public.wt_movements;
create policy wt_mov_ins on public.wt_movements
  for insert to anon, authenticated with check (true);
drop policy if exists wt_mov_sel on public.wt_movements;
create policy wt_mov_sel on public.wt_movements
  for select to anon, authenticated using (true);

grant execute on function public.wt_adjust_qty(text,integer,text,text) to anon, authenticated;

-- 5) Listo. Vuelve a la app y pulsa "⚙️ Sincronizar catálogo"
--    (una sola vez) para cargar los 582 productos del PML.
