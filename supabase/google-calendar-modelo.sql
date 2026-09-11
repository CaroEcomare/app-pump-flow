-- ============================================
-- Modelo de datos: sincronía de clase muestra con Google Calendar
-- ============================================
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.
-- Necesita la extensión pg_net (llamadas HTTP desde triggers). Si el
-- create extension de abajo da error de permisos, actívala desde el
-- Dashboard de Supabase: Database > Extensions > busca "pg_net" > Enable.

create extension if not exists pg_net with schema extensions;

-- Qué evento de Calendar corresponde al horario (fecha, hora) de esta
-- cita. Varias citas del mismo horario comparten el mismo valor aquí
-- (se sobrescribe igual en todas cuando se crea/actualiza el evento).
alter table citas_clase_muestra add column if not exists google_event_id text;

-- Un solo renglón: el refresh token de la cuenta de Google que Caro
-- conecte. "id boolean primary key default true" más el check de abajo
-- garantiza que nunca pueda haber más de un renglón.
create table if not exists google_calendar_tokens (
  id boolean primary key default true,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  constraint google_calendar_tokens_una_sola_fila check (id)
);

-- RLS activo SIN ninguna policy: nadie puede leer ni escribir esta
-- tabla desde el cliente (autenticado o no) ni desde el público. Solo
-- la Edge Function, que usa la service role key (ignora RLS), puede.
alter table google_calendar_tokens enable row level security;
