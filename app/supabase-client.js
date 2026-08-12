import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://euhltloldxnbjbizmwze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente aislado para crear la cuenta de alguien más (ej. la admin dando
// de alta a una alumna) sin tocar la sesión ya guardada en este navegador.
// persistSession/detectSessionInUrl en false evitan que pise el localStorage
// de la sesión activa de quien lo usa.
export function crearClienteTemporal() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
