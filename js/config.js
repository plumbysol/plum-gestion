const SUPABASE_URL = "https://jraocnzzktlqlenhkjpc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1MqTZ55LHn2dPtgY1GdFmA_SFaqBQe0";

const SUPABASE_CONFIGURADO =
  !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");

const db = SUPABASE_CONFIGURADO
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
