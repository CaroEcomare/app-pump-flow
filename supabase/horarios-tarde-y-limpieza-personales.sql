-- ============================================
-- Horarios de la tarde (6:40 pm y 7:30 pm) y limpieza de Silvia y Karla
-- ============================================
-- Se corre en el SQL Editor de Supabase, UN PASO A LA VEZ (copia cada
-- bloque por separado, del PASO 1 al PASO 4).
--
-- Nada de este script BORRA filas: las clases que ya pasaron, las
-- reservas, las asistencias y los paquetes se quedan tal cual. Solo:
--   · se crean horarios nuevos,
--   · las clases FUTURAS de 7:15 se cambian al horario de 6:40 (con sus
--     reservas adentro),
--   · se apagan horarios viejos y se ocultan clases personales futuras.
--
-- "Hoy" se calcula en hora de Michoacán, no en UTC, para que una clase
-- de esta noche no se cuente como pasada antes de tiempo.


-- ============================================
-- PASO 1 · Solo mirar (no cambia nada)
-- ============================================
-- Revisa que salgan los horarios de martes (2) y jueves (4) a las 19:15,
-- y que en la segunda tabla salgan SOLO Silvia y Karla. Si sale alguien
-- más, detente y avísale a Claude antes de seguir.
select id, dia_semana, hora, cupo, activo, alumna_id
from horarios
order by dia_semana, hora;

select id, nombre
from alumnas
where nombre ilike 'silvia%' or nombre ilike 'karla%';


-- ============================================
-- PASO 2 · Cambiar los horarios de la tarde (martes y jueves)
-- ============================================
begin;

-- Horarios nuevos de 6:40 y 7:30, grupales, cupo 6 (solo si no existen ya).
insert into horarios (dia_semana, hora, cupo, activo)
select v.dia, v.hora::time, 6, true
from (values (2, '18:40'), (4, '18:40'), (2, '19:30'), (4, '19:30')) as v(dia, hora)
where not exists (
  select 1 from horarios h
  where h.dia_semana = v.dia and h.hora = v.hora::time
    and h.alumna_id is null and h.activo = true
);

-- Las clases FUTURAS de 7:15 pasan a ser del horario de 6:40 del mismo
-- día. Sus reservas siguen apuntando a la misma clase, así que quien ya
-- apartó conserva su lugar. Las clases pasadas no se tocan: siguen
-- ligadas al horario de 7:15 y en el historial dicen 7:15.
update clases c
set horario_id = nuevo.id
from horarios viejo, horarios nuevo
where c.horario_id = viejo.id
  and viejo.dia_semana in (2, 4) and viejo.hora = '19:15' and viejo.alumna_id is null
  and nuevo.dia_semana = viejo.dia_semana and nuevo.hora = '18:40'
  and nuevo.alumna_id is null and nuevo.activo = true
  and c.fecha >= (now() at time zone 'America/Mexico_City')::date;

-- Se apaga el horario de 7:15 (no se borra) para que no genere más clases.
update horarios
set activo = false
where dia_semana in (2, 4) and hora = '19:15' and alumna_id is null;

-- Crea de una vez las clases de 7:30 de las próximas 4 semanas.
select generar_clases();

commit;


-- ============================================
-- PASO 3 · Silvia y Karla: quitar lo "personal" de hoy en adelante
-- ============================================
begin;

-- Apaga cualquier horario fijo personal a su nombre (no se borra).
update horarios
set activo = false
where alumna_id in (
  select id from alumnas where nombre ilike 'silvia%' or nombre ilike 'karla%'
);

-- Oculta sus clases personales de hoy en adelante. No se borran: si
-- alguna tiene una asistencia marcada, se queda en su historial y en
-- lo que lleva descontado su paquete.
update clases
set cancelada = true
where alumna_id in (
  select id from alumnas where nombre ilike 'silvia%' or nombre ilike 'karla%'
)
  and fecha >= (now() at time zone 'America/Mexico_City')::date
  and cancelada = false;

commit;


-- ============================================
-- PASO 4 · Comprobar cómo quedó (no cambia nada)
-- ============================================
-- Deben salir clases de martes y jueves a las 6:40 pm y 7:30 pm, y
-- ninguna a las 7:15 de hoy en adelante.
select c.fecha, coalesce(h.hora, c.hora) as hora, c.alumna_id, count(r.id) as reservas
from clases c
left join horarios h on h.id = c.horario_id
left join reservas r on r.clase_id = c.id
where c.cancelada = false
  and c.fecha >= (now() at time zone 'America/Mexico_City')::date
  and extract(dow from c.fecha) in (2, 4)
group by c.id, c.fecha, h.hora, c.hora, c.alumna_id
order by c.fecha, hora;
