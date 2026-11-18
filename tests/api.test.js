// Unit tests for the serverless functions with Supabase, Resend and Anthropic faked at the fetch layer.
// Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.RESEND_API_KEY = 're_test';
process.env.EMAIL_FROM = 'quotes@summitbuild.test';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

let sent = [];
let profile = { id: 'u1', email: 'owner@co.test', role: 'OWNER', active: true };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  sent.push({ url: u, init });
  if (u.endsWith('/auth/v1/user')) return init.headers.Authorization === 'Bearer good' ? json({ id: 'u1', email: 'owner@co.test' }) : json({ msg: 'bad jwt' }, 401);
  if (u.includes('/rest/v1/profiles?id=eq.')) return json(profile ? [profile] : []);
  if (u.includes('/rest/v1/profiles?role=eq.OWNER')) return json([{ id: 'u1' }]);
  if (u.includes('/rest/v1/docs?collection=eq.config')) return json([{ data: { name: 'Summit Build Co.', brand: '#F47C1A', logo: '' } }]);
  if (u.includes('/auth/v1/invite')) return json({ id: 'u-new', email: 'dana@co.test' });
  if (u.includes('/rest/v1/profiles?id=eq.u-new')) return new Response(null, { status: 204 });
  if (u === 'https://api.resend.com/emails') return json({ id: 'em_123' });
  if (u.startsWith('https://api.anthropic.com/v1/messages')) return json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } });
  return json({ error: 'unexpected ' + u }, 500);
};

function call(handler, { method = 'POST', body = {}, auth = 'Bearer good', headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, headersSent: false,
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; } };
    handler({ method, body, headers: { authorization: auth, host: 'crm.summitbuild.test', ...headers } }, res);
  });
}
const load = async (name) => (await import(`../api/${name}.js`)).default;
beforeEach(() => { sent = []; profile = { id: 'u1', email: 'owner@co.test', role: 'OWNER', active: true }; });

test('config returns public settings and company branding', async () => {
  const r = await call(await load('config'), { method: 'GET', auth: '' });
  assert.equal(r.status, 200);
  assert.equal(r.body.supabaseUrl, 'https://proj.supabase.co');
  assert.equal(r.body.email, true);
  assert.equal(r.body.needsOwner, false);
  assert.equal(r.body.company.name, 'Summit Build Co.');
  assert.ok(!('SUPABASE_SERVICE_ROLE_KEY' in r.body) && !JSON.stringify(r.body).includes('service-key'));
});

test('send-email rejects callers without a valid session', async () => {
  const r = await call(await load('send-email'), { auth: 'Bearer nope', body: { to: 'a@b.co', subject: 's', text: 't' } });
  assert.equal(r.status, 401);
});

test('send-email rejects pending users', async () => {
  profile = { ...profile, role: 'PENDING' };
  const r = await call(await load('send-email'), { body: { to: 'a@b.co', subject: 's', text: 't' } });
  assert.equal(r.status, 403);
});

test('send-email sends through Resend with attachment and reply-to', async () => {
  const r = await call(await load('send-email'), { body: { to: 'client@home.test', subject: 'Your quote Q-1001', text: 'Hi <b>there</b>', replyTo: 'office@summitbuild.test', fromName: 'Summit Build Co.', attachment: { filename: 'Q-1001.pdf', content: 'JVBERi0xLjQK' } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 'em_123');
  const req = sent.find((s) => s.url === 'https://api.resend.com/emails');
  const p = JSON.parse(req.init.body);
  assert.equal(p.from, 'Summit Build Co. <quotes@summitbuild.test>');
  assert.deepEqual(p.to, ['client@home.test']);
  assert.equal(p.reply_to, 'office@summitbuild.test');
  assert.equal(p.attachments[0].filename, 'Q-1001.pdf');
  assert.ok(p.html.includes('&lt;b&gt;'), 'message text is escaped in the HTML body');
});

test('send-email validates the address', async () => {
  const r = await call(await load('send-email'), { body: { to: 'not-an-email', subject: 's', text: 't' } });
  assert.equal(r.status, 400);
});

test('invite is admin-only', async () => {
  profile = { ...profile, role: 'REP' };
  const r = await call(await load('invite'), { body: { email: 'dana@co.test', name: 'Dana', role: 'CREW' } });
  assert.equal(r.status, 403);
});

test('invite creates the login and sets the role', async () => {
  const r = await call(await load('invite'), { body: { email: 'Dana@Co.test', name: 'Dana', role: 'CREW', memberId: 'm1' }, headers: { origin: 'https://crm.summitbuild.test' } });
  assert.equal(r.status, 200);
  const inv = sent.find((s) => s.url.includes('/auth/v1/invite'));
  assert.ok(inv.url.includes(encodeURIComponent('https://crm.summitbuild.test/')));
  assert.equal(JSON.parse(inv.init.body).email, 'dana@co.test');
  const patch = sent.find((s) => s.url.includes('profiles?id=eq.u-new'));
  assert.deepEqual(JSON.parse(patch.init.body), { role: 'CREW', name: 'Dana', member_id: 'm1', active: true });
});

test('only owners can invite owners', async () => {
  profile = { ...profile, role: 'ADMIN' };
  const r = await call(await load('invite'), { body: { email: 'x@co.test', name: 'X', role: 'OWNER' } });
  assert.equal(r.status, 403);
});

test('ai proxies to Claude with refusal fallbacks enabled', async () => {
  const r = await call(await load('ai'), { body: { messages: [{ role: 'user', content: 'hi' }], system: 'Reply JSON' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.stop_reason, 'end_turn');
  const req = sent.find((s) => s.url.startsWith('https://api.anthropic.com/v1/messages'));
  const p = JSON.parse(req.init.body);
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.fallbacks, 'default');
  const h = new Headers(req.init.headers);
  assert.ok((h.get('anthropic-beta') || '').includes('server-side-fallback-2026-07-01'));
});

test('ai rejects GET', async () => {
  const r = await call(await load('ai'), { method: 'GET' });
  assert.equal(r.status, 405);
});
