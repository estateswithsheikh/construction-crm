// Shared helpers for the serverless functions. Files starting with "_" are not routes on Vercel.
export const env = (k) => (process.env[k] || '').trim();
export const STAFF = ['OWNER', 'ADMIN', 'REP', 'CREW_LEAD', 'CREW'];

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

const supa = () => {
  const url = env('SUPABASE_URL'), service = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service) throw new HttpError(500, 'The server is missing its Supabase settings.', 'not_configured');
  return { url: url.replace(/\/$/, ''), service };
};

// Call Supabase with the service-role key (server only; bypasses row-level security).
export async function admin(path, init = {}) {
  const { url, service } = supa();
  const r = await fetch(url + path, { ...init, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok) throw new HttpError(r.status >= 500 ? 502 : r.status, (body && (body.msg || body.message || body.error_description)) || 'Supabase request failed', 'supabase');
  return body;
}

// Verify the caller's Supabase session and load their CRM profile.
export async function requireUser(req, { adminOnly = false } = {}) {
  const auth = req.headers.authorization || '';
  if (!/^Bearer \S+$/.test(auth)) throw new HttpError(401, 'Sign in first.', 'unauthenticated');
  const { url, service } = supa();
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY') || service, Authorization: auth } });
  if (!r.ok) throw new HttpError(401, 'Your session expired. Sign in again.', 'unauthenticated');
  const user = await r.json();
  const rows = await admin(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`);
  const profile = rows && rows[0];
  if (!profile || !profile.active || !STAFF.includes(profile.role)) throw new HttpError(403, 'Your login doesn\'t have access to the CRM.', 'forbidden');
  if (adminOnly && !['OWNER', 'ADMIN'].includes(profile.role)) throw new HttpError(403, 'Only an owner or admin can do that.', 'forbidden');
  return { user, profile };
}

export function handler(fn, { methods = ['POST'] } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }); }
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json(out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error(e);
      res.status(status).json({ error: e instanceof HttpError ? e.message : 'Something went wrong on the server.', code: e.code || 'error' });
    }
  };
}

export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(s);
