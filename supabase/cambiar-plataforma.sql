-- ============================================
-- Cambiar cómo paga una alumna (Wellhub, TotalPass o paga directo)
-- ============================================
-- Desde la app nadie puede editar la columna "plataforma" de alumnas
-- directo (solo nombre y teléfono; ver actualizaciones.sql). Así una
-- alumna no puede ponerse Wellhub ella sola para tener plan activo.
-- Esta función deja que SOLO la admin lo cambie desde su ficha.
-- Es "security definer" para poder saltarse ese candado, por eso lo
-- primero que hace es revisar que quien la llama sea admin.
-- No toca paquetes, asistencias ni valoraciones.
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.

create or replace function cambiar_plataforma(p_alumna_id uuid, p_plataforma text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo la administradora puede cambiar cómo paga una alumna';
  end if;
  -- El check de la columna ya solo acepta 'no', 'wellhub' o 'totalpass'.
  update alumnas set plataforma = p_plataforma where id = p_alumna_id;
end;
$$;

grant execute on function cambiar_plataforma(uuid, text) to authenticated;
