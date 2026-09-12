-- ============================================
-- Trigger: avisar a gcal-sync cuando se agenda o cancela una cita
-- ============================================
-- Pega este archivo DESPUÉS de google-calendar-modelo.sql y de
-- desplegar la Edge Function gcal-sync (Task 8). Si lo pegas antes de
-- desplegar la función, no truena nada — la llamada HTTP simplemente
-- fallará silenciosamente (pg_net no bloquea el insert/update aunque
-- la llamada falle) hasta que la función exista.

create or replace function trigger_sincronizar_clase_muestra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_hora time;
begin
  v_fecha := coalesce(new.fecha, old.fecha);
  v_hora := coalesce(new.hora, old.hora);

  begin
    perform net.http_post(
      url := 'https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9'
      ),
      body := jsonb_build_object('fecha', v_fecha, 'hora', v_hora)
    );
  exception when others then
    raise warning 'gcal-sync no se pudo disparar: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists sincronizar_clase_muestra_insert on citas_clase_muestra;
create trigger sincronizar_clase_muestra_insert
  after insert on citas_clase_muestra
  for each row execute function trigger_sincronizar_clase_muestra();

drop trigger if exists sincronizar_clase_muestra_cancelacion on citas_clase_muestra;
create trigger sincronizar_clase_muestra_cancelacion
  after update of cancelada on citas_clase_muestra
  for each row
  when (old.cancelada is distinct from new.cancelada)
  execute function trigger_sincronizar_clase_muestra();
