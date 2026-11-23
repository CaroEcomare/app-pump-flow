-- ============================================
-- Testimonios: alumnas que comparten su experiencia desde index.html
-- ============================================
-- Cualquiera (sin cuenta) puede ENVIAR su testimonio, pero solo la admin
-- puede verlos, cambiarles el estado o borrarlos. Nada se publica solo:
-- todo entra como 'pendiente' y Caro decide cuáles agregar al carrusel.
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.
--
-- Para ver los nuevos: Table Editor → testimonios (o SQL:
--   select * from testimonios where estado = 'pendiente' order by creado_en desc; )

create table if not exists testimonios (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  experiencia text not null check (length(trim(experiencia)) between 1 and 2000),
  clase text check (clase is null or clase in ('Grupal presencial', 'Grupal en línea', 'Personal', 'Curso en línea')),
  whatsapp text check (whatsapp is null or length(trim(whatsapp)) between 7 and 30),
  acepta_publicar boolean not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'descartado'))
);

alter table testimonios enable row level security;

-- Solo se guardan si aceptó que se publique con su nombre de pila,
-- y siempre entran como pendientes.
drop policy if exists "cualquiera envia su testimonio" on testimonios;
create policy "cualquiera envia su testimonio" on testimonios
  for insert to anon, authenticated
  with check (acepta_publicar = true and estado = 'pendiente');

drop policy if exists "admin ve testimonios" on testimonios;
create policy "admin ve testimonios" on testimonios for select using (es_admin());

drop policy if exists "admin edita testimonios" on testimonios;
create policy "admin edita testimonios" on testimonios for update using (es_admin());

drop policy if exists "admin borra testimonios" on testimonios;
create policy "admin borra testimonios" on testimonios for delete using (es_admin());

-- Desde la página solo se llenan estas columnas (la fecha, el id y el
-- estado los pone la base de datos, no quien envía el formulario).
revoke all on testimonios from anon, authenticated;
grant insert (nombre, experiencia, clase, whatsapp, acepta_publicar) on testimonios to anon, authenticated;
grant select, update, delete on testimonios to authenticated;
