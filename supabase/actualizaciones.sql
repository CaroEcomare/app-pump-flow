-- ============================================
-- Pump&Flow — Actualizaciones para conectar la app
-- Pega TODO este archivo en el SQL Editor de Supabase y córrelo,
-- igual que hiciste con supabase.sql.
-- ============================================

-- Permite que la administradora confirme la asistencia de una alumna
-- aunque esa alumna nunca haya hecho su propio check-in (hoy solo la
-- propia alumna puede crear su fila en "asistencias").
create policy "admin crea asistencia" on asistencias
  for insert with check (es_admin());

-- Genera las clases faltantes de las próximas 4 semanas a partir de
-- los horarios activos. Es "security definer" para que cualquier
-- alumna que entre a la app también pueda dispararla (ella no tiene
-- permiso directo para crear filas en "clases", pero la función corre
-- con los permisos de quien la creó).
create or replace function generar_clases()
returns void language plpgsql security definer set search_path = public as $$
declare
  h record;
  fecha_cursor date;
  fecha_limite date := current_date + interval '4 weeks';
begin
  for h in select * from horarios where activo = true loop
    fecha_cursor := current_date;
    while fecha_cursor <= fecha_limite loop
      if extract(dow from fecha_cursor) = h.dia_semana then
        insert into clases (horario_id, fecha, cupo)
        values (h.id, fecha_cursor, h.cupo)
        on conflict (horario_id, fecha) do nothing;
      end if;
      fecha_cursor := fecha_cursor + 1;
    end loop;
  end loop;
end;
$$;

grant execute on function generar_clases() to authenticated;
