-- ============================================
-- Clase muestra grupal: quitar la exclusividad de horario
-- ============================================
-- Antes, un horario de clase muestra solo podía tener UNA cita activa
-- (pensado como sesión 1 a 1). Ahora la clase muestra es grupal: varias
-- personas pueden agendar el mismo (fecha, hora). Pega este archivo
-- completo en el SQL Editor de Supabase y córrelo.

drop index if exists citas_clase_muestra_fecha_hora_activa;

-- Ya no se usa (la pantalla pública ya no oculta horarios ocupados).
drop function if exists slots_ocupados_clase_muestra();
