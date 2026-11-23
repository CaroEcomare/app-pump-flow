-- ============================================
-- Testimonios que se publican solos
-- ============================================
-- Desde ahora cada testimonio nuevo entra como 'aprobado' y aparece en el
-- carrusel de index.html sin que Caro tenga que hacer nada.
-- La página solo puede leer el NOMBRE y el TEXTO de los aprobados; el
-- WhatsApp, la clase y los demás datos siguen siendo solo para la admin.
--
-- Para ocultar uno: Table Editor → testimonios → cambia su "estado" a
-- 'descartado'. Desaparece de la página al recargar.
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.

-- Los nuevos entran aprobados.
alter table testimonios alter column estado set default 'aprobado';

drop policy if exists "cualquiera envia su testimonio" on testimonios;
create policy "cualquiera envia su testimonio" on testimonios
  for insert to anon, authenticated
  with check (acepta_publicar = true and estado = 'aprobado');

-- La página (sin cuenta) puede ver los aprobados, pero solo estas columnas.
drop policy if exists "pagina ve aprobados" on testimonios;
create policy "pagina ve aprobados" on testimonios
  for select to anon using (estado = 'aprobado');
grant select (id, creado_en, nombre, experiencia) on testimonios to anon;

-- Limpieza: borra las pruebas de Claude y publica los que ya estaban esperando.
delete from testimonios where nombre = 'PRUEBA - borrar';
delete from leads where nombre = 'PRUEBA - borrar';
update testimonios set estado = 'aprobado' where estado = 'pendiente';
