import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  construirResumenClaseMuestra,
  decidirAccionCalendario,
  construirRangoEvento,
} from '../_shared/gcal-logic.js';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function obtenerAccessToken() {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('refresh_token')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) throw new Error('Google Calendar no está conectado todavía');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`No se pudo refrescar el token de Google: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

serve(async (req) => {
  try {
    const { fecha, hora } = await req.json();

    const { data: citas, error: citasError } = await supabaseAdmin
      .from('citas_clase_muestra')
      .select('nombre, telefono, google_event_id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancelada', false);
    if (citasError) throw citasError;

    const eventoExistente = citas.find((c) => c.google_event_id)?.google_event_id ?? null;
    const accion = decidirAccionCalendario({ eventoExistente, cantidadPersonas: citas.length });

    if (accion === 'ninguna') {
      return new Response(JSON.stringify({ ok: true, accion }), { status: 200 });
    }

    const accessToken = await obtenerAccessToken();

    if (accion === 'borrar') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoExistente}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await supabaseAdmin
        .from('citas_clase_muestra')
        .update({ google_event_id: null })
        .eq('fecha', fecha)
        .eq('hora', hora);
      return new Response(JSON.stringify({ ok: true, accion }), { status: 200 });
    }

    const { titulo, descripcion } = construirResumenClaseMuestra(citas);
    const { inicio, fin } = construirRangoEvento(fecha, hora);
    const cuerpoEvento = {
      summary: titulo,
      description: descripcion,
      start: { dateTime: inicio, timeZone: 'America/Mexico_City' },
      end: { dateTime: fin, timeZone: 'America/Mexico_City' },
    };

    const url = accion === 'crear'
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoExistente}`;
    const metodo = accion === 'crear' ? 'POST' : 'PATCH';

    const eventRes = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoEvento),
    });
    const eventJson = await eventRes.json();
    if (!eventRes.ok) throw new Error(`Google Calendar respondió con error: ${JSON.stringify(eventJson)}`);

    await supabaseAdmin
      .from('citas_clase_muestra')
      .update({ google_event_id: eventJson.id })
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancelada', false);

    return new Response(JSON.stringify({ ok: true, accion, eventId: eventJson.id }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
});
