import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://euhltloldxnbjbizmwze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
