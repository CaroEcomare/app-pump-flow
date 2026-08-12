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

-- ============================================
-- De dónde llega cada alumna (Wellhub, TotalPass, o directo)
-- ============================================
-- Guarda si viene de una plataforma externa, para tus reportes con
-- Wellhub/TotalPass. No cambia el apartado de clases: cualquier alumna
-- puede apartar su lugar sin importar esto ni si tiene paquete pagado,
-- eso ya funcionaba así (tú decides en persona quién debe o no dinero).
alter table alumnas add column if not exists plataforma text not null default 'no'
  check (plataforma in ('no', 'wellhub', 'totalpass'));

-- ============================================
-- Cuentas creadas por Caro con usuario y contraseña (sin correo real)
-- ============================================
-- Para alumnado que Caro da de alta ella misma, sin depender de que
-- tengan o revisen un correo. El login acepta correo O usuario.
alter table alumnas add column if not exists username text unique;

-- Resuelve el correo interno asociado a un usuario, para poder iniciar
-- sesión con nombre de usuario en vez de correo. Solo expone el correo
-- de ESE usuario puntual, nada más de la tabla. Se ejecuta antes de
-- iniciar sesión, por eso "anon" también necesita permiso.
create or replace function correo_de_usuario(nombre_usuario text)
returns text language sql security definer stable set search_path = public as $$
  select email from auth.users where id = (
    select id from alumnas where username = nombre_usuario
  );
$$;

grant execute on function correo_de_usuario(text) to anon, authenticated;

-- ============================================
-- Auto-confirma asistencia de clases que ya pasaron y nadie resolvió
-- ============================================
-- Si nadie canceló su lugar y Caro no confirmó su asistencia, en cuanto
-- la clase ya pasó de hora se cuenta como tomada (se descuenta igual el
-- paquete, vía el trigger que ya existe, trg_descuenta_ins). Se llama
-- sola cada vez que alguien abre la app, igual que generar_clases().
create or replace function procesar_asistencias_pasadas()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into asistencias (alumna_id, clase_id, confirmada_admin)
  select r.alumna_id, r.clase_id, now()
  from reservas r
  join clases c on c.id = r.clase_id
  join horarios h on h.id = c.horario_id
  where (c.fecha + h.hora) < now()
    and c.cancelada = false
    and not exists (
      select 1 from asistencias a
      where a.alumna_id = r.alumna_id and a.clase_id = r.clase_id
    )
  on conflict (alumna_id, clase_id) do nothing;
end;
$$;

grant execute on function procesar_asistencias_pasadas() to authenticated;
