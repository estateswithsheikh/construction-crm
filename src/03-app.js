/* ============ Calculations ============ */
const taxRate = (opt) => (opt && opt.taxType === 'none' ? 0 : num(S.cfg.taxRate) / 100);
function optCalc(opt, q) {
  const items = (opt && opt.items) || [];
  const sub = sum(items, (it) => (it.included ? 0 : num(it.qty) * num(it.rate)));
  const d = (q && q.discount) || {};
  const dv = num(d.value);
  const has = d.type && d.type !== 'none' && dv > 0;
  let pre = 0, post = 0;
  if (has && d.applies !== 'post') pre = Math.min(sub, d.type === 'percent' ? (sub * dv) / 100 : dv);
  const taxable = Math.max(0, sub - pre);
  const tax = taxable * taxRate(opt);
  let total = taxable + tax;
  if (has && d.applies === 'post') { post = Math.min(total, d.type === 'percent' ? (total * dv) / 100 : dv); total -= post; }
  return { sub: round2(sub), discount: round2(pre + post), taxable: round2(taxable), tax: round2(tax), total: round2(total), net: round2(taxable - post) };
}
const quoteCalcs = (q) => (q.options || []).map((o) => optCalc(o, q));
function quoteValue(q) {
  const c = quoteCalcs(q); const o = q.options || [];
  const acc = o.map((x, i) => (x.accepted ? i : -1)).filter((i) => i >= 0);
  return acc.length ? sum(acc, (i) => c[i].total) : (c[0] ? c[0].total : 0);
}
function quoteStatus(q) {
  const st = q.status || 'new';
  if ((st === 'pending' || st === 'follow_up') && q.expiresAt && q.expiresAt < todayKey()) return 'expired';
  return st;
}
const quoteTitle = (q) => q.title || (q.client && q.client.name ? q.client.name : 'Untitled quote');
const invPaid = (inv) => sum(inv.payments || [], (p) => p.amount);
function invStatus(inv) {
  if (inv.void) return 'void';
  const paid = invPaid(inv);
  if (num(inv.total) > 0 && paid >= num(inv.total) - 0.005) return 'paid';
  return paid > 0 ? 'partial' : 'pending';
}
const invDue = (inv) => (inv.void ? 0 : Math.max(0, round2(num(inv.total) - invPaid(inv))));
const invOpen = (inv) => ['pending', 'partial'].includes(invStatus(inv));
const invOverdueDays = (inv) => (invOpen(inv) && inv.dueDate && inv.dueDate < todayKey() ? daysBetween(inv.dueDate, todayKey()) : 0);
const invNet = (inv) => (inv.void ? 0 : num(inv.total) - num(inv.tax));
const expNet = (e) => num(e.amount) - num(e.hst);

function invCommission(inv) {
  const rep = byId('team', inv.repId);
  if (!rep || inv.void) return { rep: null, amount: 0 };
  return { rep, amount: round2((invNet(inv) * num(rep.commissionPct)) / 100) };
}
function projectFin(p) {
  const inv = byId('invoices', p.invoiceId);
  const revenue = inv ? invNet(inv) : num(p.revenue);
  const labor = p.labor || [];
  const hours = sum(labor, (l) => l.hours);
  const crewCost = sum(labor, (l) => num(l.hours) * num(l.rate));
  const ex = D('expenses').filter((e) => e.projectId === p.id);
  const subs = sum(ex.filter((e) => e.category === 'Subcontractor'), expNet);
  const laborExp = sum(ex.filter((e) => e.category === 'Labor'), expNet);
  const materials = sum(ex.filter((e) => e.category !== 'Subcontractor' && e.category !== 'Labor'), expNet);
  const commission = inv ? invCommission(inv).amount : 0;
  const cost = crewCost + laborExp + subs + materials + commission;
  const profit = revenue - cost;
  return { revenue, hours, labor: crewCost + laborExp, subs, materials, commission, cost, profit, margin: revenue > 0 ? profit / revenue : null, inv };
}

/* Date ranges */
const RANGES = [['7d', 'Last 7D'], ['30d', 'Last 30D'], ['90d', 'Last 90D'], ['mtd', 'MTD'], ['ytd', 'YTD'], ['all', 'All time']];
function rangeOf(k) {
  const t = new Date(); const to = dkey(t);
  if (k === '7d') return { from: keyPlus(-6), to };
  if (k === '30d') return { from: keyPlus(-29), to };
  if (k === '90d') return { from: keyPlus(-89), to };
  if (k === '60d') return { from: keyPlus(-59), to };
  if (k === 'week') { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: dkey(d), to }; }
  if (k === 'mtd') return { from: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`, to };
  if (k === 'ytd') return { from: `${t.getFullYear()}-01-01`, to };
  return { from: '2000-01-01', to: '2999-12-31' };
}
const inR = (v, r) => { if (!v) return false; const k = String(v).slice(0, 10); return k >= r.from && k <= r.to; };
const monthsIn = (r) => Math.max(0, (daysBetween(r.from, r.to) + 1) / 30.4375);

/* ============ Navigation ============ */
const NAV = [
  { r: 'dashboard', l: 'Dashboard', i: 'home' },
  { r: 'ai', l: 'AI Assistant', i: 'sparkles', roles: ['OWNER', 'REP'] },
  { r: 'insights', l: 'Insights', i: 'chart', roles: ['OWNER', 'REP', 'CREW_LEAD'] },
  { r: 'leads', l: 'Leads', i: 'clipboard', roles: ['OWNER', 'REP'] },
  { r: 'customers', l: 'Customers', i: 'users', roles: ['OWNER', 'REP'] },
  { r: 'quotes', l: 'Quotes', i: 'briefcase', roles: ['OWNER', 'REP'] },
  { r: 'invoices', l: 'Invoices', i: 'receipt', roles: ['OWNER', 'REP'] },
  { r: 'projects', l: 'Projects', i: 'hardhat' },
  { r: 'calendar', l: 'Schedule Calendar', i: 'calendar' },
  { r: 'expenses', l: 'Expenses', i: 'dollar' },
  { r: 'overhead', l: 'Overhead', i: 'building', roles: ['OWNER'] },
  { r: 'payroll', l: 'Payroll', i: 'wallet' },
  { r: 'commissions', l: 'Rep Commissions', i: 'percent', roles: ['OWNER', 'REP'], indent: true },
  { r: 'profit', l: 'Cost & Profit Analysis', i: 'box', roles: ['OWNER', 'REP'] },
  { r: 'today', l: 'My Today', i: 'listchecks' },
  { r: 'followups', l: 'Follow-ups', i: 'phone', roles: ['OWNER', 'REP'] }
];
const NAV2 = [{ r: 'company', l: 'Company Settings', i: 'sliders' }, { r: 'team', l: 'Team', i: 'users' }];
const PARENT = { lead: 'leads', quote: 'quotes', invoice: 'invoices', project: 'projects' };
const allowed = (n) => !n.roles || n.roles.includes(S.role);

function go(route, param) {
  const h = route + (param ? '-' + param : '');
  if (S.dirty && h !== location.hash.slice(1)) {
    confirmBox('Discard unsaved changes?', 'You have edits on this page that haven\'t been saved.', 'Discard', () => { S.dirty = false; S.draft = null; location.hash = h; });
    return;
  }
  if (route === 'ai') { toggleAI(true); return; }
  if (location.hash.slice(1) === h) { readHash(); render(); window.scrollTo(0, 0); } else location.hash = h;
}
let lastHash = '';
function readHash() {
  const h = location.hash.slice(1) || 'dashboard';
  const i = h.indexOf('-');
  const route = i > 0 ? h.slice(0, i) : h;
  const param = i > 0 ? h.slice(i + 1) : null;
  if (!V[route]) { S.route = 'dashboard'; S.param = null; return; }
  if (S.route !== route || S.param !== param) { S.draft = null; S.dirty = false; }
  S.route = route; S.param = param;
  lastHash = h;
}
window.addEventListener('hashchange', () => {
  if (S.dirty && location.hash.slice(1) !== lastHash) {
    const target = location.hash.slice(1);
    history.replaceState(null, '', '#' + lastHash);
    confirmBox('Discard unsaved changes?', 'You have edits on this page that haven\'t been saved.', 'Discard', () => { S.dirty = false; S.draft = null; location.hash = target; });
    return;
  }
  readHash(); closeDrawer(); render(); window.scrollTo(0, 0);
});

/* ============ Shell rendering ============ */
const V = {}; // views registered by the view files
function navHTML() {
  const cur = PARENT[S.route] || S.route;
  const link = (n) => `<a href="#${n.r}" data-go="${n.r}" class="${cur === n.r ? 'on' : ''} ${n.indent ? 'indent' : ''}">${icon(n.i)}<span>${esc(n.l)}</span></a>`;
  return `<div class="eyebrow">Workspace</div>${NAV.filter(allowed).map(link).join('')}<div class="sep"></div><div class="eyebrow">Configuration</div>${NAV2.map(link).join('')}`;
}
function sideHTML() {
  const th = getTheme();
  const thIcon = th === 'dark' ? 'moon' : th === 'light' ? 'sun' : 'monitor';
  return `<div class="brand"><div class="logo">${logoHTML()}</div><div class="crm">CRM<small>${esc(S.cfg.name)}</small></div><button class="iconbtn" data-act="theme" title="Theme: ${th}" aria-label="Switch theme (now ${th})">${icon(thIcon)}</button></div>
  <nav class="nav" aria-label="Main">${navHTML()}</nav>
  <div class="side-foot">${S.me.name ? `Signed in as <b>${esc(S.me.name)}</b><br>` : ''}${esc(ROLES[S.role] || S.role)} view${S.mode === 'local' ? ' · preview' : ''}${S.mode === 'cloud' ? ' · <button class="linkbtn" data-act="signout">Sign out</button>' : ''}</div>`;
}
function tabbarHTML() {
  const cur = PARENT[S.route] || S.route;
  const t = [['dashboard', 'Home', 'home'], ['today', 'Today', 'listchecks'], ['quotes', 'Quotes', 'briefcase'], ['projects', 'Projects', 'hardhat']].filter(([r]) => allowed(NAV.find((n) => n.r === r) || {}));
  return t.map(([r, l, i]) => `<a href="#${r}" data-go="${r}" class="${cur === r ? 'on' : ''}">${icon(i)}${l}</a>`).join('') + `<button data-act="drawer">${icon('menu')}More</button>`;
}
function bannersHTML() {
  let b = '';
  if (S.mode === 'local') b += `<div class="banner">${icon('alert')}<span><b>Preview mode.</b> The shared database isn't connected in this view, so changes stay on this screen only. Open the CRM on claude.ai while signed in to save records for your team.</span></div>`;
  else if (S.mode === 'live' && !S.canWrite) b += `<div class="banner">${icon('shield')}<span><b>View-only access.</b> Ask the owner to share this CRM with you as a Contributor so you can see and edit records.</span></div>`;
  if (S.stale) b += `<div class="banner info">${icon('clock')}<span>Can't reach your data yet. What you see may be out of date; it will refresh on its own.</span></div>`;
  return b;
}
let renderPending = false, deferred = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { deferred = true; return; }
    if ($('#modal') && $('#modal').dataset.lock) { deferred = true; return; }
    render();
  });
}
document.addEventListener('focusout', () => { if (deferred) setTimeout(() => { const a = document.activeElement; if (!(a && a.closest && a.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { deferred = false; render(); } }, 60); });

function render() {
  computeRole();
  const app = $('#app');
  if (!app.dataset.built) {
    app.innerHTML = `<div class="shell"><aside class="side" id="side"></aside><div class="main"><div id="banners"></div><main id="main"></main></div></div><nav class="tabbar" id="tabbar" aria-label="Quick"></nav><button class="fab" data-act="ai" title="AI assistant" aria-label="Open AI assistant">${icon('sparkles')}</button>`;
    app.dataset.built = '1';
  }
  const view = V[S.route] || V.dashboard;
  const navItem = NAV.concat(NAV2).find((n) => n.r === (PARENT[S.route] || S.route));
  if (navItem && !allowed(navItem) && S.loaded.team) { S.route = 'dashboard'; }
  $('#side').innerHTML = sideHTML();
  $('#tabbar').innerHTML = tabbarHTML();
  $('#banners').innerHTML = bannersHTML();
  const scrollY = window.scrollY;
  let html;
  try { html = view.render(); } catch (e) { console.error(e); html = `<div class="panel empty"><h3>This page hit a problem</h3><p>${esc(e.message)}</p><button class="btn" data-go="dashboard">Back to dashboard</button></div>`; }
  $('#main').innerHTML = `<div class="page">${html}</div>`;
  if (view.mount) try { view.mount(); } catch (e) { console.error(e); }
  window.scrollTo(0, scrollY);
  const dr = $('#drawer'); if (dr) dr.querySelector('.side').innerHTML = sideHTML();
}
function renderResults() { const v = V[S.route]; const box = $('#results'); if (v && v.results && box) box.innerHTML = v.results(); }

function openDrawer() {
  closeDrawer();
  const d = document.createElement('div'); d.className = 'drawer'; d.id = 'drawer';
  d.innerHTML = `<aside class="side">${sideHTML()}</aside>`;
  d.addEventListener('mousedown', (e) => { if (e.target === d) closeDrawer(); });
  document.body.appendChild(d);
}
function closeDrawer() { const d = $('#drawer'); if (d) d.remove(); }

/* ============ Events ============ */
const ACT = {
  'modal-close': () => closeModal(),
  theme: () => { const order = ['system', 'light', 'dark']; const t = order[(order.indexOf(getTheme()) + 1) % 3]; setTheme(t); render(); toast('Theme: ' + t); },
  drawer: () => openDrawer(),
  ai: () => toggleAI(),
  ui: (el) => { const k = el.dataset.k; let v = el.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; S.ui[k] = (el.dataset.toggle && S.ui[k] === v) ? (el.dataset.off ?? 'all') : v; if (el.dataset.reset) el.dataset.reset.split(',').forEach((r) => delete S.ui[r]); render(); },
  copy: (el) => copyText(el.dataset.text || '')
};
document.addEventListener('click', async (e) => {
  const goEl = e.target.closest('[data-go]');
  if (goEl && !e.target.closest('[data-act]')) {
    e.preventDefault(); closeDrawer();
    go(goEl.dataset.go, goEl.dataset.param);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  if (el.dataset.busy) return;
  try { el.dataset.busy = '1'; await fn(el, e); }
  catch (err) { console.error(err); if (!err || !err.shown) toast((err && err.message) || 'Something went wrong.', 'bad'); }
  finally { delete el.dataset.busy; }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.f) { S.ui[el.dataset.f] = el.value; renderResults(); return; }
  if (el.dataset.bind && S.draft) {
    const v = el.type === 'checkbox' ? el.checked : (el.dataset.num !== undefined ? (el.value === '' ? '' : num(el.value)) : el.value);
    setPath(S.draft, el.dataset.bind, v); S.dirty = true;
    const view = V[S.route]; if (view && view.onBind) view.onBind(el.dataset.bind, el);
  }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.fsel) { S.ui[el.dataset.fsel] = el.value; render(); return; }
  if (el.dataset.bind && S.draft && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    setPath(S.draft, el.dataset.bind, v); S.dirty = true;
    render();
  }
  if (el.dataset.onchange && ACT[el.dataset.onchange]) Promise.resolve(ACT[el.dataset.onchange](el, e)).catch((err) => { console.error(err); if (!err.shown) toast(err.message || 'Something went wrong.', 'bad'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('#modal')) closeModal(); else if ($('#drawer')) closeDrawer(); }
  if (e.key === 'Enter' && e.target.closest && e.target.closest('tr.click,.li.click,.kcard') && e.target.matches('tr,.li,.kcard')) e.target.click();
});

/* ============ Shared UI pieces ============ */
function pageHead({ eyebrow, title, lede, acts = '' }) {
  return `<div class="phead"><div style="min-width:0"><div class="eyebrow">${eyebrow}</div><h1 class="title">${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div><div class="acts">${acts}</div></div>`;
}
const btn = (label, act, o = {}) => `<button class="btn ${o.cls || ''}" ${act ? `data-act="${act}"` : ''} ${o.go ? `data-go="${o.go}"` : ''} ${o.param ? `data-param="${esc(o.param)}"` : ''} ${o.attrs || ''} ${o.disabled ? 'disabled' : ''}>${o.icon ? icon(o.icon) : ''}${esc(label)}</button>`;
function chips(key, list, cur, o = {}) {
  return `<div class="chips">${list.map(([v, l, ct]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-act="ui" data-k="${key}" data-v="${esc(v)}" ${o.reset ? `data-reset="${o.reset}"` : ''}>${esc(l)}${typeof ct === 'number' ? `<span class="ct">${ct}</span>` : ''}</button>`).join('')}</div>`;
}
const searchBox = (key, ph) => `<div class="search grow">${icon('search')}<input class="inp" data-f="${key}" value="${esc(S.ui[key] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" id="s-${key}"></div>`;
const emptyBox = (ic, title, text, cta = '') => `<div class="empty"><div class="ic">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta}</div>`;
function pager(key, total) {
  const per = num(UI(key + '.per', 50)); const page = Math.min(num(UI(key + '.page', 0)), Math.max(0, Math.ceil(total / per) - 1));
  const from = total ? page * per + 1 : 0, to = Math.min(total, (page + 1) * per);
  return { per, page, slice: (arr) => arr.slice(page * per, page * per + per), html: `<div class="row between" style="padding:12px 4px;border-top:1px solid var(--border);margin-top:16px"><span class="small muted">${total ? `${from}–${to} of ${total}` : 'No rows'}</span><div class="row"><span class="small muted">Rows / page:</span><select class="inp inp-sm" style="width:auto" data-fsel="${key}.per" aria-label="Rows per page">${[25, 50, 100].map((n) => `<option ${n === per ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="iconbtn" data-act="ui" data-k="${key}.page" data-v="${Math.max(0, page - 1)}" ${page === 0 ? 'disabled' : ''} aria-label="Previous page">${icon('chevL')}</button><button class="iconbtn" data-act="ui" data-k="${key}.page" data-v="${page + 1}" ${to >= total ? 'disabled' : ''} aria-label="Next page">${icon('chevR')}</button></div></div>` };
}
const match = (q, ...fields) => { q = String(q || '').trim().toLowerCase(); if (!q) return true; return fields.some((f) => String(f || '').toLowerCase().includes(q)); };
const loadingRows = () => `<div class="pad stack">${[1, 2, 3].map(() => '<div class="skeleton"></div>').join('')}</div>`;
const ready = (...cols) => cols.every((c) => S.loaded[c]);
