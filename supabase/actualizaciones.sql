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

-- ============================================
-- Seguridad: que una alumna no pueda hacerse administradora
-- ============================================
-- La policy "alumna edita su perfil" deja que cada quien edite SU fila,
-- pero no dice QUÉ columnas puede tocar: desde las herramientas del
-- navegador, cualquier alumna podría ponerse es_admin = true.
-- Con esto, la única actualización posible desde la app es a su nombre
-- y su teléfono. (La app nunca actualiza "alumnas" desde el cliente, así
-- que esto no rompe nada. Tú, desde el panel de Supabase, sigues pudiendo
-- editar todo con normalidad.)
revoke update on alumnas from authenticated;
grant update (nombre, telefono) on alumnas to authenticated;

-- ============================================
-- Descontar la clase también cuando tú confirmas sin check-in previo
-- ============================================
-- El trigger que ya existe ("trg_descuenta") solo corre al ACTUALIZAR una
-- asistencia. Cuando confirmas a una alumna que nunca hizo check-in, se
-- CREA la fila, así que la clase nunca se descontaba de su paquete.
-- Aquí actualizamos la función para que sirva en los dos casos y
-- agregamos el trigger que faltaba, el de creación.
create or replace function descuenta_clase()
returns trigger language plpgsql as $$
declare
  antes_sin_confirmar boolean;
begin
  -- Ojo: "old" no existe cuando la fila apenas se está creando,
  -- por eso se consulta solo en el caso de actualización.
  if tg_op = 'INSERT' then
    antes_sin_confirmar := true;
  else
    antes_sin_confirmar := old.confirmada_admin is null;
  end if;

  if new.confirmada_admin is not null and antes_sin_confirmar then
    update paquetes set clases_usadas = clases_usadas + 1
    where alumna_id = new.alumna_id and activo = true
      and clases_usadas < clases_totales;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_descuenta_ins on asistencias;
create trigger trg_descuenta_ins after insert on asistencias
  for each row execute function descuenta_clase();
