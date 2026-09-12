import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Seguridad: este endpoint es público y no verifica quién llama. Está a
// salvo de que alguien más conecte su propia cuenta de Google SOLO porque
// la pantalla de consentimiento OAuth en Google Cloud está en modo "Prueba"
// con la cuenta de Caro como única usuaria de prueba autorizada. Si esa
// pantalla llega a publicarse ("En producción"), cualquier cuenta de Google
// podría completar el flujo y secuestrar la sincronía. No publicar la app
// de OAuth en Google Cloud.

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!;
const APP_URL = Deno.env.get('APP_URL')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  // Paso 1: sin código todavía. Manda a Caro a la pantalla de permisos de Google.
  if (!code) {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return Response.redirect(authUrl.toString(), 302);
  }

  // Paso 2: Google ya regresó con el código. Lo cambiamos por tokens.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error('Error al cambiar el código por tokens:', tokenData);
    return Response.redirect(`${APP_URL}?gcal=error`, 302);
  }

  const { error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .upsert({ id: true, refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() });

  if (error) {
    console.error('Error al guardar el token:', error);
    return Response.redirect(`${APP_URL}?gcal=error`, 302);
  }

  return Response.redirect(`${APP_URL}?gcal=conectado`, 302);
});
