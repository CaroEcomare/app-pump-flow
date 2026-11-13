-- ============================================
-- Leads: personas que dejan sus datos en la página del curso
-- ============================================
-- Cualquiera (sin cuenta) puede DEJAR sus datos desde el formulario de
-- curso.html, pero solo la admin puede verlos o borrarlos. Quien llena el
-- formulario no puede leer los datos de nadie más, ni siquiera los suyos.
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.
--
-- Para ver tus leads: Table Editor → leads (o SQL:
--   select * from leads order by creado_en desc; )

create table if not exists leads (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  whatsapp text not null check (length(trim(whatsapp)) between 7 and 30),
  correo text check (correo is null or length(correo) <= 200),
  origen text not null default 'curso' check (origen in ('curso')),
  acepta_contacto boolean not null
);

alter table leads enable row level security;

-- Solo se guardan si aceptó que la contacten (la casilla es obligatoria).
drop policy if exists "cualquiera deja sus datos" on leads;
create policy "cualquiera deja sus datos" on leads
  for insert to anon, authenticated with check (acepta_contacto = true);

drop policy if exists "admin ve leads" on leads;
create policy "admin ve leads" on leads for select using (es_admin());

drop policy if exists "admin borra leads" on leads;
create policy "admin borra leads" on leads for delete using (es_admin());

-- Desde la página solo se pueden llenar estas columnas (la fecha y el id
-- los pone la base de datos, no quien envía el formulario).
revoke all on leads from anon, authenticated;
grant insert (nombre, whatsapp, correo, origen, acepta_contacto) on leads to anon, authenticated;
grant select, delete on leads to authenticated;
