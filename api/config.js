// Public settings the browser needs to start: Supabase project, enabled features, company branding for the sign-in page.
import { env, admin, handler } from './_lib.js';

export default handler(async () => {
  const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY');
  if (!url || !anon) return { supabaseUrl: null };
  let company = null, needsOwner = false;
  if (env('SUPABASE_SERVICE_ROLE_KEY')) {
    try {
      const [cfg] = await admin('/rest/v1/docs?collection=eq.config&id=eq.company&select=data');
      if (cfg && cfg.data) { const { name, logo, brand, tagline } = cfg.data; company = { name, logo, brand, tagline }; }
      const owners = await admin('/rest/v1/profiles?role=eq.OWNER&select=id&limit=1');
      needsOwner = !owners || owners.length === 0;
    } catch (e) { console.error('config lookup failed', e.message); }
  }
  return {
    supabaseUrl: url,
    supabaseAnonKey: anon,
    needsOwner,
    email: Boolean(env('RESEND_API_KEY')),
    ai: Boolean(env('ANTHROPIC_API_KEY')),
    company
  };
}, { methods: ['GET'] });
