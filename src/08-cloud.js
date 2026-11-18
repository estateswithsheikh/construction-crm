/* ============ Standalone mode: Supabase auth + data, Resend email, Claude AI ============ */
let SB = null, CLOUD = null, PROFILE = null;
const STAFF_ROLES = ['OWNER', 'ADMIN', 'REP', 'CREW_LEAD', 'CREW'];
const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', REP: 'Sales rep', CREW_LEAD: 'Crew lead', CREW: 'Crew', PENDING: 'No access yet' };

/* Overrides of shared hooks (later declarations win) */
function computeRole() {
  if (S.mode === 'cloud') { const r = PROFILE && PROFILE.role; S.role = r === 'ADMIN' ? 'OWNER' : r || 'REP'; return; }
  if (S.mode !== 'live' || S.isAdmin) { S.role = 'OWNER'; return; }
  const m = myMember();
  S.role = !m ? 'REP' : m.type === 'crew' ? m.role || 'CREW' : m.type === 'rep' ? 'REP' : 'CREW';
}
async function saveFile(filename, data) {
  const type = /\.csv$/i.test(filename) ? 'text/csv' : /\.json$/i.test(filename) ? 'application/json' : /\.pdf$/i.test(filename) ? 'application/pdf' : 'application/octet-stream';
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------- Server calls ---------- */
async function api(path, body) {
  const { data } = await SB.auth.getSession();
  const token = data && data.session && data.session.access_token;
  let r;
  try { r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) }); }
  catch { const e = new Error('Can\'t reach the server. Check your connection.'); e.code = 'network'; throw e; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Request failed (' + r.status + ')'); e.code = j.code || (r.status === 429 ? 'rate_limited' : 'error'); throw e; }
  return j;
}

/* ---------- AI: same shape as the artifact sampler, backed by /api/ai ---------- */
function echoable(content) {
  // After a mid-output model fallback, drop thinking/tool_use blocks that come before the last fallback block.
  const last = content.map((b) => b.type).lastIndexOf('fallback');
  if (last < 0) return content;
  return content.filter((b, i) => i >= last || !['thinking', 'redacted_thinking', 'tool_use'].includes(b.type));
}
const textOf = (r) => (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
async function getSampler() {
  if (!CLOUD || !CLOUD.ai) return null;
  const run = async (msgs, opts = {}) => {
    const tools = (opts.tools || []).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    const messages = msgs.map((m) => ({ role: m.role, content: m.content }));
    for (let turn = 0; turn < 8; turn++) {
      const r = await api('/api/ai', { messages, tools, system: opts.system });
      if (r.stop_reason === 'refusal') return { text: 'Claude declined to answer that one. Try rephrasing the question.' };
      if (r.stop_reason !== 'tool_use') { const text = textOf(r); if (opts.onText) opts.onText({ text, delta: text }); return { text }; }
      messages.push({ role: 'assistant', content: echoable(r.content) });
      const results = [];
      for (const b of r.content.filter((x) => x.type === 'tool_use')) {
        const t = (opts.tools || []).find((x) => x.name === b.name);
        try { results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(t ? await t.execute(b.input || {}) : { error: 'Unknown tool' }).slice(0, 30000) }); }
        catch (e) { results.push({ type: 'tool_result', tool_use_id: b.id, content: String((e && e.message) || e), is_error: true }); }
      }
      messages.push({ role: 'user', content: results });
    }
    return { text: 'That took too many steps. Try a narrower question.' };
  };
  run.json = async (prompt) => {
    const r = await api('/api/ai', { messages: [{ role: 'user', content: prompt }], system: 'Reply with only the JSON value requested. No prose and no code fences.' });
    if (r.stop_reason === 'refusal') { const e = new Error('declined'); e.code = 'refused'; throw e; }
    const t = textOf(r).trim();
    const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
    let v = tryParse(t);
    if (v === undefined) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) v = tryParse(f[1]); }
    if (v === undefined) { const a = Math.min(...['{', '['].map((c) => (t.indexOf(c) < 0 ? Infinity : t.indexOf(c)))); const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']')); if (a < b) v = tryParse(t.slice(a, b + 1)); }
    if (v === undefined) { const e = new Error('invalid_json'); e.code = 'invalid_json'; throw e; }
    return v;
  };
  return run;
}

/* ---------- Data store on Supabase (one `docs` table, JSON per record) ---------- */
function dbFail(error) {
  console.error(error);
  const code = error && (error.code === '42501' || /row-level security|permission/i.test(error.message || '')) ? 'invalid_argument' : 'unavailable';
  loadAll().catch(() => {});
  return fail({ code });
}
const CloudStore = {
  async add(col, data, id) {
    id = id || uid();
    const body = Store.strip(Store.stamp(data, true));
    S.data[col] = [...D(col), { id, ...body }]; scheduleRender();
    const { error } = await Store.queue(col + '/' + id, () => SB.from('docs').insert({ collection: col, id, data: body }));
    if (error) return dbFail(error);
    return id;
  },
  async set(col, id, data) {
    const body = Store.strip(Store.stamp(data, false));
    S.data[col] = D(col).some((x) => x.id === id) ? D(col).map((x) => (x.id === id ? { id, ...body } : x)) : [...D(col), { id, ...body }]; scheduleRender();
    const { error } = await Store.queue(col + '/' + id, () => SB.from('docs').upsert({ collection: col, id, data: body }));
    if (error) return dbFail(error);
  },
  async update(col, id, patch) {
    const body = JSON.parse(JSON.stringify({ ...patch, updatedAt: nowISO() }));
    S.data[col] = D(col).map((x) => (x.id === id ? { ...x, ...body } : x)); scheduleRender();
    const { error } = await Store.queue(col + '/' + id, () => SB.rpc('doc_merge', { p_collection: col, p_id: id, p_patch: body }));
    if (error) return dbFail(error);
  },
  async del(col, id) {
    S.data[col] = D(col).filter((x) => x.id !== id); scheduleRender();
    const { error } = await Store.queue(col + '/' + id, () => SB.from('docs').delete().match({ collection: col, id }));
    if (error) return dbFail(error);
  },
  async saveCfg(cfg) {
    const body = JSON.parse(JSON.stringify({ ...cfg, updatedAt: nowISO() }));
    S.cfg = { ...DEFAULT_CFG, ...body }; applyBrand(); render();
    const { error } = await Store.queue('config/company', () => SB.from('docs').upsert({ collection: 'config', id: 'company', data: body }));
    if (error) return dbFail(error);
  }
};
async function loadAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await SB.from('docs').select('collection,id,data').order('collection').order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const next = Object.fromEntries(COLS.map((c) => [c, []]));
  rows.forEach((r) => {
    if (r.collection === 'config') { if (r.id === 'company') S.cfg = { ...DEFAULT_CFG, ...r.data }; }
    else if (next[r.collection]) next[r.collection].push({ id: r.id, ...r.data });
  });
  S.data = next; COLS.forEach((c) => (S.loaded[c] = true)); S.stale = false;
  applyBrand(); scheduleRender();
}
function subscribeDocs() {
  SB.channel('docs-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (p) => {
      const row = p.eventType === 'DELETE' ? p.old : p.new;
      if (!row || !row.collection) return;
      const c = row.collection;
      if (c === 'config') { if (p.eventType !== 'DELETE' && row.id === 'company') { S.cfg = { ...DEFAULT_CFG, ...row.data }; applyBrand(); scheduleRender(); } return; }
      if (!S.data[c]) return;
      if (p.eventType === 'DELETE') S.data[c] = S.data[c].filter((x) => x.id !== row.id);
      else { const rec = { id: row.id, ...row.data }; const i = S.data[c].findIndex((x) => x.id === row.id); S.data[c] = i >= 0 ? S.data[c].map((x, k) => (k === i ? rec : x)) : [...S.data[c], rec]; }
      scheduleRender();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { if (!S.stale) { S.stale = true; scheduleRender(); } }
      if (status === 'SUBSCRIBED' && S.stale) loadAll().catch(() => {});
    });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.stale) loadAll().catch(() => {}); });
}

/* ---------- Auth screens ---------- */
function authShell(inner) {
  const c = S.cfg;
  $('#app').dataset.built = '';
  $('#app').innerHTML = `<div class="auth"><aside class="auth-art"><div class="auth-logo">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)} logo">` : `<span class="mark">${esc(initials(c.name))}</span>`}</div>
    <div><div class="eyebrow accent">Operations console · CRM</div><h1 class="auth-h">Every job,<br><span>quote to paid.</span></h1><p class="auth-p">Leads, quotes, crews, hours and invoices for ${esc(c.name)}, in one place your whole team can reach from the office or the job site.</p></div>
    <div class="xs" style="color:#9aa3b2">${icon('shield')} Secured sign-in · ${esc(c.name)}</div></aside>
    <main class="auth-main"><div class="auth-card">${inner}</div></main></div>`;
}
function loginScreen(msg) {
  const owner = CLOUD && CLOUD.needsOwner;
  authShell(owner ? `<div class="eyebrow">First-time setup</div><h2 class="title" style="font-size:34px">Create the owner account.</h2><p class="lede small">This first account controls the CRM: company settings, team logins and payroll.</p>
    <form id="auth-form" class="stack" style="margin-top:22px">${F.text('name', 'Your name', '', { req: true })}${F.text('email', 'Email address', '', { type: 'email', req: true })}${F.text('password', 'Password', '', { type: 'password', req: true, hint: 'At least 8 characters.' })}<div id="auth-msg" class="small" role="alert"></div><button class="btn btn-primary" style="width:100%;justify-content:space-between">Create owner account ${icon('arrowR')}</button></form>`
    : `<div class="eyebrow">Sign in</div><h2 class="title" style="font-size:34px">Welcome back.</h2><p class="lede small">Use your ${esc(S.cfg.name)} login to open the operations console.</p>
    <form id="auth-form" class="stack" style="margin-top:22px">${F.text('email', 'Email address', '', { type: 'email', req: true })}<div class="field"><label for="f-password">Password</label><div style="position:relative"><input class="inp" id="f-password" name="password" type="password" required autocomplete="current-password" style="padding-right:44px"><button type="button" class="iconbtn" id="pw-toggle" style="position:absolute;right:3px;top:3px;border:0" aria-label="Show password">${icon('eye')}</button></div></div>
    <div id="auth-msg" class="small" role="alert">${msg ? esc(msg) : ''}</div><button class="btn btn-primary" style="width:100%;justify-content:space-between">Sign in ${icon('arrowR')}</button>
    <div class="row between small" style="border-top:1px solid var(--border);padding-top:14px;margin-top:6px"><button type="button" class="linkbtn" id="forgot">Forgot password?</button><span class="muted">No login? Ask your owner to invite you.</span></div></form>`);
  const form = $('#auth-form'), out = $('#auth-msg');
  const say = (t, bad) => { out.textContent = t; out.style.color = bad ? 'var(--danger)' : 'var(--ok)'; };
  const tg = $('#pw-toggle'); if (tg) tg.onclick = () => { const p = $('#f-password'); p.type = p.type === 'password' ? 'text' : 'password'; };
  const fg = $('#forgot'); if (fg) fg.onclick = async () => { const email = $('#f-email').value.trim(); if (!email) { say('Enter your email first, then click Forgot password.', true); return; } const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }); say(error ? error.message : 'Check your email for a link to set a new password.', !!error); };
  form.onsubmit = async (e) => {
    e.preventDefault(); const f = formData(form); const b = form.querySelector('.btn-primary'); b.disabled = true;
    try {
      if (owner) {
        if ((f.password || '').length < 8) { say('Use at least 8 characters for the password.', true); return; }
        const { data, error } = await SB.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name }, emailRedirectTo: location.origin + '/' } });
        if (error) { say(error.message, true); return; }
        if (data.session) { CLOUD.needsOwner = false; await enterApp(data.session); } else { CLOUD.needsOwner = false; loginScreen('Account created. Check your email to confirm it, then sign in.'); }
      } else {
        const { data, error } = await SB.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) { say(/invalid/i.test(error.message) ? 'That email and password don\'t match. Try again or reset your password.' : error.message, true); return; }
        await enterApp(data.session);
      }
    } finally { b.disabled = false; }
  };
  setTimeout(() => { const i = form.querySelector('input'); if (i) i.focus(); }, 30);
}
function setPasswordScreen(session, kind) {
  authShell(`<div class="eyebrow">${kind === 'invite' ? 'Welcome aboard' : 'Reset password'}</div><h2 class="title" style="font-size:34px">Set your password.</h2><p class="lede small">${esc(session.user.email)}</p>
    <form id="pw-form" class="stack" style="margin-top:22px">${F.text('p1', 'New password', '', { type: 'password', req: true, hint: 'At least 8 characters.' })}${F.text('p2', 'Confirm password', '', { type: 'password', req: true })}<div id="auth-msg" class="small" role="alert"></div><button class="btn btn-primary" style="width:100%;justify-content:space-between">Save and continue ${icon('arrowR')}</button></form>`);
  $('#pw-form').onsubmit = async (e) => {
    e.preventDefault(); const f = formData($('#pw-form')); const out = $('#auth-msg'); out.style.color = 'var(--danger)';
    if (f.p1.length < 8) { out.textContent = 'Use at least 8 characters.'; return; }
    if (f.p1 !== f.p2) { out.textContent = 'The two passwords don\'t match.'; return; }
    const { error } = await SB.auth.updateUser({ password: f.p1 });
    if (error) { out.textContent = error.message; return; }
    await enterApp(session);
  };
}
function pendingScreen(session, prof) {
  authShell(`<div class="eyebrow">Almost there</div><h2 class="title" style="font-size:34px">${prof && !prof.active ? 'Your access is turned off.' : 'Waiting for access.'}</h2><p class="lede small">You're signed in as <b>${esc(session.user.email)}</b>, but ${prof && !prof.active ? 'an owner has deactivated this login' : 'an owner hasn\'t given this login a role yet'}. Ask them to open <b>Team → Login users</b> and set your role.</p><div class="row" style="margin-top:22px"><button class="btn" id="re">${icon('refresh')}Check again</button><button class="btn btn-ghost" id="so">Sign out</button></div>`);
  $('#re').onclick = () => enterApp(session); $('#so').onclick = () => SB.auth.signOut().then(() => location.reload());
}

/* ---------- Enter the app ---------- */
async function enterApp(session) {
  const { data: prof, error } = await SB.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) { loginScreen('Couldn\'t load your profile. Check that the database is set up, then try again.'); return; }
  PROFILE = prof;
  if (!prof || !prof.active || !STAFF_ROLES.includes(prof.role)) { pendingScreen(session, prof); return; }
  S.me = { id: prof.id, name: prof.name || prof.email }; S.isAdmin = prof.role === 'OWNER' || prof.role === 'ADMIN'; S.canWrite = true; S.myLink = prof.member_id || null;
  Object.assign(Store, CloudStore);
  COLS.forEach((c) => (S.loaded[c] = false));
  $('#app').innerHTML = ''; delete $('#app').dataset.built;
  readHash(); render();
  try { await loadAll(); } catch (e) { console.error(e); S.stale = true; COLS.forEach((c) => (S.loaded[c] = true)); render(); toast('Couldn\'t load your data. Refresh to try again.', 'bad'); }
  subscribeDocs();
}
ACT.signout = async () => { await SB.auth.signOut(); location.hash = ''; location.reload(); };
ACT['tm-link'] = async (el) => {
  const id = el.value || null;
  const { error } = await SB.from('profiles').update({ member_id: id }).eq('id', S.me.id);
  if (error) { toast('Couldn\'t save the link.', 'bad'); return; }
  S.myLink = id; PROFILE.member_id = id; render(); toast(id ? 'Linked to your login' : 'Unlinked');
};

/* ---------- Team → Login users ---------- */
async function loadUsers() {
  const { data, error } = await SB.from('profiles').select('*').order('created_at');
  if (!error) { S.users = data; if (S.route === 'team') render(); }
}
function usersTabHTML() {
  if (!S.users) { loadUsers(); }
  const rows = S.users || [];
  const roleOpts = (cur, self) => Object.keys(ROLE_LABEL).filter((r) => r !== 'OWNER' || PROFILE.role === 'OWNER' || cur === 'OWNER').map((r) => `<option value="${r}" ${cur === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('');
  return pageHead({ eyebrow: 'Configuration · Team', title: 'Crew & reps', lede: 'Login accounts with access to the CRM, and what each one can do.', acts: S.isAdmin ? btn('Invite user', 'user-invite', { cls: 'btn-primary', icon: 'plus' }) : '' })
    + `<div class="tabs"><button class="on" data-act="ui" data-k="team.tab" data-v="users">${icon('shield')}Login users (${rows.length})</button>${TEAM_TABS.map(([k, l, i]) => `<button data-act="ui" data-k="team.tab" data-v="${k}">${icon(i)}${l} (${D('team').filter((t) => t.type === k).length})</button>`).join('')}</div>
    <div class="panel tablewrap">${!S.users ? loadingRows() : `<table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team record</th><th>Status</th></tr></thead><tbody>${rows.map((u) => { const self = u.id === S.me.id; const can = S.isAdmin && !(u.role === 'OWNER' && PROFILE.role !== 'OWNER'); return `<tr><td class="cell-main">${esc(u.name || '—')}${self ? ' <span class="badge c-pri">You</span>' : ''}</td><td class="small">${esc(u.email)}</td>
      <td>${can ? `<select class="inp inp-sm" style="width:150px" data-onchange="user-role" data-id="${u.id}" aria-label="Role for ${esc(u.email)}">${roleOpts(u.role, self)}</select>` : `<span class="badge ${u.role === 'PENDING' ? 'c-warn' : 'c-grey'}">${ROLE_LABEL[u.role] || u.role}</span>`}</td>
      <td class="small">${esc(pname(u.member_id) || '—')}</td>
      <td>${can && !self ? `<button class="chip ${u.active ? 'on' : ''}" data-act="user-active" data-id="${u.id}">${u.active ? 'Active' : 'Off'}</button>` : u.active ? '<span class="badge c-ok">Active</span>' : '<span class="badge c-grey">Off</span>'}</td></tr>`; }).join('')}</tbody></table>`}</div>
    <div class="panel pad" style="margin-top:20px"><div class="eyebrow" style="margin-bottom:8px">Roles</div><p class="small" style="margin:0;max-width:76ch"><b>Owner / Admin</b>: everything, including company settings, team, overhead and payroll payments. <b>Sales rep</b>: leads, customers, quotes, invoices, follow-ups. <b>Crew lead / Crew</b>: projects, schedule, hours, expenses and their own pay. New sign-ups wait at <b>No access yet</b> until you give them a role.</p></div>`;
}
ACT['user-role'] = async (el) => {
  const { error } = await SB.from('profiles').update({ role: el.value }).eq('id', el.dataset.id);
  if (error) { toast(/owner/i.test(error.message) ? error.message : 'Couldn\'t change the role.', 'bad'); }
  else toast('Role updated');
  await loadUsers();
};
ACT['user-active'] = async (el) => {
  const u = (S.users || []).find((x) => x.id === el.dataset.id); if (!u) return;
  const { error } = await SB.from('profiles').update({ active: !u.active }).eq('id', u.id);
  if (error) toast(/owner/i.test(error.message) ? error.message : 'Couldn\'t change access.', 'bad'); else toast(u.active ? 'Access turned off' : 'Access turned on');
  await loadUsers();
};
ACT['user-invite'] = () => openModal({
  title: 'Invite a user',
  body: `<p class="small muted" style="margin:0">They get an email with a link to set their password.</p><div class="grid2">${F.text('name', 'Name', '', { req: true })}${F.text('email', 'Email', '', { type: 'email', req: true })}${F.select('role', 'Role', Object.keys(ROLE_LABEL).filter((r) => r !== 'PENDING' && (r !== 'OWNER' || PROFILE.role === 'OWNER')).map((r) => [r, ROLE_LABEL[r]]), 'REP')}${F.select('memberId', 'Team record (optional)', [['', '— None —'], ...team().map((t) => [t.id, t.name])], '')}</div>`,
  foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="inv-send">${icon('send')}Send invite</button>`,
  onMount: (m) => { $('#inv-send', m).onclick = async (ev) => { const f = formData(m); if (!f.name || !/^\S+@\S+\.\S+$/.test(f.email)) { toast('Enter a name and a valid email.', 'bad'); return; } ev.target.disabled = true; try { await api('/api/invite', f); closeModal(); toast(`Invite sent to ${f.email}`); loadUsers(); } catch (e) { toast(e.message, 'bad'); ev.target.disabled = false; } }; }
});

/* ---------- Email quotes & invoices to clients ---------- */
const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
function emailModal(kind, d) {
  if (!d) { toast('Save your changes first.', 'bad'); return; }
  const c = S.cfg, name = (d.client && d.client.name) || '', first = name.split(/\s|&/)[0] || 'there';
  const sign = `${S.me.name || c.name}\n${c.name}${c.phone ? '\n' + c.phone : ''}`;
  const subject = kind === 'quote' ? `Your quote ${d.ref} from ${c.name}` : `Invoice ${d.number} from ${c.name}`;
  const n = (d.options || []).length;
  const text = kind === 'quote'
    ? `Hi ${first},\n\nThanks for having us out. Your quote ${d.ref}${d.title ? ' for ' + d.title : ''} is attached${n > 1 ? `, with ${n} options to choose from` : ''}. It's valid until ${fmtDate(d.expiresAt || keyPlus(num(d.validityDays) || 30))}.\n\nReply to this email or call ${c.phone || 'us'} with any questions, or to book your start date.\n\nThanks,\n${sign}`
    : `Hi ${first},\n\nInvoice ${d.number} for ${money(d.total)} is attached. The balance due is ${money(invDue(d))}, payable by ${fmtDate(d.dueDate)}.${d.terms ? '\n\nPayment terms: ' + d.terms : ''}\n\nThank you for your business.\n\n${sign}`;
  openModal({
    title: kind === 'quote' ? 'Email quote to client' : 'Email invoice to client',
    body: `<div class="grid2">${F.text('to', 'To', (d.client && d.client.email) || '', { type: 'email', req: true })}${F.text('cc', 'CC (optional)', '', { type: 'email' })}${F.text('subject', 'Subject', subject, { span: true })}${F.area('text', 'Message', text, { rows: 10 })}</div><label class="check"><input type="checkbox" name="attach" checked> Attach ${kind} PDF</label><div class="hint">Replies go to ${esc(c.email || PROFILE.email)}.</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="em-send">${icon('send')}Send email</button>`,
    onMount: (m) => {
      $('#modal').dataset.lock = '1';
      $('#em-send', m).onclick = async (ev) => {
        const f = formData(m);
        if (!/^\S+@\S+\.\S+$/.test(f.to)) { toast('Enter the client\'s email address.', 'bad'); return; }
        if (f.cc && !/^\S+@\S+\.\S+$/.test(f.cc)) { toast('The CC address doesn\'t look right.', 'bad'); return; }
        ev.target.disabled = true; ev.target.textContent = 'Sending…';
        try {
          let attachment = null;
          if (f.attach) { const blob = await buildPDF(kind, d); attachment = { filename: `${kind === 'quote' ? d.ref : d.number}.pdf`, content: await blobToB64(blob) }; }
          await api('/api/send-email', { to: f.to, cc: f.cc || undefined, subject: f.subject, text: f.text, replyTo: c.email || PROFILE.email, fromName: c.name, attachment });
          const at = nowISO();
          if (kind === 'quote') {
            const q = byId('quotes', d.id) || d;
            const patch = { activity: qlog(q, `Emailed to ${f.to}`), lastEmailedAt: at };
            if ((q.status || 'new') === 'new') { const fu = new Date(); fu.setDate(fu.getDate() + (num(c.followUpDays) || 3)); fu.setHours(10, 0, 0, 0); Object.assign(patch, { status: 'pending', sentAt: at, expiresAt: keyPlus(num(q.validityDays) || 30), followUpAt: localDT(fu) }); }
            await Store.update('quotes', q.id, patch); S.draft = null;
          } else {
            const i = byId('invoices', d.id) || d;
            await Store.update('invoices', i.id, { emailedAt: at, activity: [...(i.activity || []), { at, text: `Emailed to ${f.to}`, by: S.me.id }] });
          }
          closeModal(); toast(`Email sent to ${f.to}`);
        } catch (e) { toast(e.message || 'The email wasn\'t sent.', 'bad'); ev.target.disabled = false; ev.target.innerHTML = icon('send') + 'Send email'; }
      };
    }
  });
}
ACT['q-email'] = () => { if (S.dirty) { toast('Save your changes first.', 'bad'); return; } emailModal('quote', byId('quotes', S.param)); };
ACT['inv-email'] = () => emailModal('invoice', byId('invoices', S.param));

/* ---------- Boot ---------- */
async function cloudBoot() {
  setTheme(getTheme());
  let cfg = null;
  try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch {}
  if (!cfg || !cfg.supabaseUrl || !window.supabase) { boot(); return; } // no server config: local preview mode
  CLOUD = cfg; S.mode = 'cloud'; S.emailEnabled = !!cfg.email;
  if (cfg.company) S.cfg = { ...DEFAULT_CFG, ...cfg.company };
  applyBrand();
  const flow = (/[#&]type=(invite|recovery|signup|magiclink)/.exec(location.hash) || [])[1];
  const authErr = (/[#&]error_description=([^&]+)/.exec(location.hash) || [])[1];
  SB = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  const { data } = await SB.auth.getSession();
  if (/access_token=|error=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  const session = data && data.session;
  SB.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { location.hash = ''; location.reload(); } });
  if (!session) { loginScreen(authErr ? decodeURIComponent(authErr.replace(/\+/g, ' ')) : ''); return; }
  if (flow === 'invite' || flow === 'recovery') { setPasswordScreen(session, flow); return; }
  await enterApp(session);
}
