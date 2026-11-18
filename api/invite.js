// Owner/admin invites a teammate: Supabase emails them a link to set a password; we set their role.
import { handler, requireUser, admin, HttpError, isEmail } from './_lib.js';

const ROLES = ['OWNER', 'ADMIN', 'REP', 'CREW_LEAD', 'CREW'];

export default handler(async (req) => {
  const { profile } = await requireUser(req, { adminOnly: true });
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 120);
  const role = String(b.role || 'REP');
  const memberId = b.memberId ? String(b.memberId).slice(0, 64) : null;
  if (!isEmail(email) || !name) throw new HttpError(400, 'Enter a name and a valid email.', 'bad_request');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Pick a valid role.', 'bad_request');
  if (role === 'OWNER' && profile.role !== 'OWNER') throw new HttpError(403, 'Only an owner can invite another owner.', 'forbidden');

  const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : '');
  let user;
  try {
    user = await admin(`/auth/v1/invite${origin ? `?redirect_to=${encodeURIComponent(origin + '/')}` : ''}`, { method: 'POST', body: JSON.stringify({ email, data: { name } }) });
  } catch (e) {
    if (/already|registered|exists/i.test(e.message)) throw new HttpError(409, 'That email already has a login. Change their role in the list instead.', 'exists');
    throw e;
  }
  const id = user && (user.id || (user.user && user.user.id));
  if (!id) throw new HttpError(502, 'The invite was sent but no user id came back. Refresh the list.', 'supabase');
  // The sign-up trigger creates the profile as PENDING; set the chosen role here (service key, so it's allowed).
  await admin(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ role, name, member_id: memberId, active: true }) });
  return { id };
});
