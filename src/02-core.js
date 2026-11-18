/* ============ Core: helpers, icons, state, store ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + num(f ? f(x) : x), 0);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dkey(new Date());
const parseKey = (k) => { if (!k) return null; const [y, m, d] = String(k).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const keyPlus = (n, from) => dkey(addDays(from ? parseKey(from) : new Date(), n));
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const localDT = (d) => `${dkey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDate = (v) => (v ? new Date(String(v).length === 10 ? v + 'T00:00' : v) : null);

function money(n, dec = 2) {
  const v = num(n);
  const s = Math.abs(v).toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (v < 0 ? '-' : '') + (S.cfg.currency || '$') + s;
}
const money0 = (n) => money(n, 0);
function fmtDate(v, opts) {
  const d = toDate(v); if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-CA', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}
const fmtShort = (v) => fmtDate(v, { month: 'short', day: 'numeric' });
function fmtDT(v) {
  const d = toDate(v); if (!d || isNaN(d)) return '—';
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function ago(v) {
  const d = toDate(v); if (!d) return '—';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  return fmtDate(v);
}
const pct = (n, dec = 0) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(dec) + '%');
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const initials = (s) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'CO';

/* ---------- Icons (24px grid, stroke) ---------- */
const IC = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  sparkles: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  hardhat: '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6M14 6a6 6 0 0 1 6 6v3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  listchecks: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  arrowR: '<path d="M5 12h14M12 5l7 7-7 7"/>', arrowL: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  kanban: '<path d="M6 5v11M12 5v6M18 5v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  truck: '<path d="M5 18H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h11v13"/><path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  hammer: '<path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9"/><path d="M17.64 15 22 10.64M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  copyplus: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2M15 12v6M12 15h6"/>'
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- Constants ---------- */
const ROLES = { OWNER: 'Owner', REP: 'Sales rep', CREW_LEAD: 'Crew lead', CREW: 'Crew' };
const LEAD_STATUS = [['new', 'New', 'c-info'], ['contacted', 'Contacted', 'c-warn'], ['quoted', 'Quoted', 'c-violet'], ['lost', 'Lost', 'c-bad']];
const QUOTE_STATUS = [['new', 'New', 'c-grey'], ['pending', 'Pending', 'c-warn'], ['approved', 'Approved', 'c-ok'], ['scheduled', 'Scheduled', 'c-info'], ['in_progress', 'In progress', 'c-violet'], ['paid', 'Paid', 'c-ok'], ['follow_up', 'Follow-up', 'c-pri'], ['lost', 'Lost', 'c-bad'], ['expired', 'Expired', 'c-grey']];
const PROJECT_STATUS = [['pending', 'Pending', 'c-grey'], ['scheduled', 'Scheduled', 'c-info'], ['in_progress', 'In progress', 'c-pri'], ['on_hold', 'On hold', 'c-warn'], ['completed', 'Completed', 'c-ok'], ['cancelled', 'Cancelled', 'c-bad']];
const INVOICE_STATUS = [['pending', 'Pending', 'c-warn'], ['partial', 'Partial', 'c-info'], ['paid', 'Paid', 'c-ok'], ['void', 'Void', 'c-grey']];
const EXPENSE_CATS = ['Materials', 'Gas', 'Dump', 'Equipment', 'Subcontractor', 'Permits', 'Food', 'Rental', 'Other', 'Labor'];
const PAY_METHODS = ['E-transfer', 'Cheque', 'Cash', 'Credit card', 'Financing', 'Other'];
const CATEGORIES = ['Residential', 'Commercial', 'Industrial'];
const statusMeta = (list, k) => list.find((s) => s[0] === k) || [k, k || '—', 'c-grey'];
const badge = (list, k, extra = '') => { const [, l, c] = statusMeta(list, k); return `<span class="badge ${c} ${extra}">${esc(l)}</span>`; };
const exTag = (r) => (r && r.example ? '<span class="ex">EXAMPLE</span>' : '');

const DEFAULT_CFG = {
  name: 'New Construction Co.', tagline: 'General & exterior contracting', phone: '', email: '', address: '', website: '', logo: '',
  brand: '#F47C1A', currency: '$', taxLabel: 'HST', taxRate: 13, quoteValidity: 30, invoiceDueDays: 14, followUpDays: 3,
  quotePrefix: 'Q-', invoicePrefix: 'INV-',
  services: ['Fencing', 'Decking', 'Interlocking & Paving', 'Concrete & Asphalt', 'Landscaping', 'Masonry', 'Interior Renovations', 'Roofing', 'Siding & Eavestroughs', 'Permit Drawings'],
  sources: ['Google', 'Meta', 'Referral', 'Walk-in', 'Bark', 'Home Depot', 'Return Client', 'Other'],
  paymentTerms: '40% deposit to book the start date, 50% on material delivery, 10% on completion. Payable by e-transfer or cheque.',
  warranty: '2-year workmanship warranty on all labour. Manufacturer warranties apply to materials. Warranty excludes damage from misuse, ground movement, and work by others.'
};

/* ---------- State ---------- */
const COLS = ['leads', 'quotes', 'invoices', 'projects', 'expenses', 'team', 'overhead', 'payouts'];
const S = {
  data: Object.fromEntries(COLS.map((c) => [c, []])),
  loaded: {}, cfg: { ...DEFAULT_CFG }, mode: 'loading', stale: false,
  me: { id: null, name: '' }, isAdmin: true, canWrite: true, role: 'OWNER',
  route: 'dashboard', param: null, ui: {}, draft: null, dirty: false, names: {}
};
const UI = (k, d) => (S.ui[k] === undefined ? (S.ui[k] = typeof d === 'function' ? d() : d) : S.ui[k]);
const D = (c) => S.data[c] || [];
const byId = (c, id) => (id ? D(c).find((x) => x.id === id) : null);
const team = () => D('team').filter((t) => t.active !== false);
const crewList = () => team().filter((t) => t.type === 'crew');
const repList = () => team().filter((t) => t.type === 'rep');
const subList = () => team().filter((t) => t.type === 'sub');
const pname = (id) => byId('team', id)?.name || '';
const myMember = () => (S.myLink ? byId('team', S.myLink) : null);

/* ---------- Store (shared db, or in-memory preview) ---------- */
const Store = {
  db: null, unsub: [], q: {},
  queue(path, fn) { const p = (this.q[path] || Promise.resolve()).catch(() => {}).then(fn); this.q[path] = p; return p; },
  stamp(data, isNew) { const t = nowISO(); const o = { ...data, updatedAt: t }; if (isNew) { o.createdAt = o.createdAt || t; if (S.me.id) o.createdBy = S.me.id; } return o; },
  strip(o) { const c = { ...o }; delete c.id; return JSON.parse(JSON.stringify(c)); },
  async add(col, data, id) {
    id = id || uid();
    const body = this.strip(this.stamp(data, true));
    if (this.db) await this.queue(col + '/' + id, () => this.db.collection(col).doc(id).set(body)).catch((e) => fail(e));
    else { S.data[col] = [...D(col), { id, ...body }]; scheduleRender(); }
    return id;
  },
  async set(col, id, data) {
    const body = this.strip(this.stamp(data, false));
    if (this.db) return this.queue(col + '/' + id, () => this.db.collection(col).doc(id).set(body)).catch((e) => fail(e));
    S.data[col] = D(col).map((x) => (x.id === id ? { id, ...body } : x)); scheduleRender();
  },
  async update(col, id, patch) {
    const body = JSON.parse(JSON.stringify({ ...patch, updatedAt: nowISO() }));
    if (this.db) return this.queue(col + '/' + id, () => this.db.collection(col).doc(id).update(body)).catch((e) => fail(e));
    S.data[col] = D(col).map((x) => (x.id === id ? { ...x, ...body } : x)); scheduleRender();
  },
  async del(col, id) {
    if (this.db) return this.queue(col + '/' + id, () => this.db.collection(col).doc(id).delete()).catch((e) => fail(e));
    S.data[col] = D(col).filter((x) => x.id !== id); scheduleRender();
  },
  async saveCfg(cfg) {
    const body = JSON.parse(JSON.stringify({ ...cfg, updatedAt: nowISO() }));
    if (this.db) return this.queue('config/company', () => this.db.doc('config/company').set(body)).catch((e) => fail(e));
    S.cfg = { ...DEFAULT_CFG, ...body }; applyBrand(); render();
  }
};
function fail(e) {
  const code = e && e.code;
  if (code === 'invalid_argument') toast(S.isAdmin ? 'That change was refused. Check the fields and try again.' : 'You don\'t have permission to change this. Ask the owner for Contributor or Editor access.', 'bad');
  else if (code === 'quota_exceeded') toast('The database is full. Delete old records (or example data) to add more.', 'bad');
  else if (code === 'resource_exhausted') toast('Too many changes at once. Wait a moment and try again.', 'bad');
  else toast('Couldn\'t save that change. Check your connection and try again.', 'bad');
  const err = new Error('save failed'); err.shown = true; err.cause = e; throw err;
}

function nextNumber(col, field, prefix) {
  const max = D(col).reduce((m, r) => Math.max(m, parseInt(String(r[field] || '').replace(/\D/g, ''), 10) || 0), 1000);
  return prefix + (max + 1);
}

/* ---------- Toasts ---------- */
function toast(msg, kind = 'ok') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = (kind === 'bad' ? icon('alert') : icon('check')) + `<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6000 : 3200);
}

/* ---------- Modal ---------- */
let modalCleanup = null;
function openModal({ title, body, foot, wide, onMount, onClose }) {
  closeModal();
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'modal';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov);
  modalCleanup = onClose || null;
  const first = ov.querySelector('input:not([type=checkbox]),select,textarea');
  if (first) setTimeout(() => first.focus(), 30);
  if (onMount) onMount(ov);
  return ov;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); if (modalCleanup) { const f = modalCleanup; modalCleanup = null; f(); } }
function formData(root) {
  const o = {};
  $$('[name]', root).forEach((el) => {
    if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? '' : num(el.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}
function confirmBox(title, text, okLabel, onOk, danger = true) {
  openModal({
    title, body: `<p style="margin:0">${esc(text)}</p>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${esc(okLabel)}</button>`,
    onMount: (m) => { $('#cf-ok', m).onclick = async () => { closeModal(); await onOk(); }; }
  });
}

/* ---------- Form field builders ---------- */
const F = {
  text: (name, label, val = '', o = {}) => `<div class="field" ${o.span ? 'style="grid-column:1/-1"' : ''}><label for="f-${name}">${esc(label)}${o.req ? ' *' : ''}</label><input class="inp" id="f-${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val)}" placeholder="${esc(o.ph || '')}" ${o.req ? 'required' : ''} ${o.step ? `step="${o.step}"` : ''} ${o.min != null ? `min="${o.min}"` : ''}>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</div>`,
  area: (name, label, val = '', o = {}) => `<div class="field" ${o.span !== false ? 'style="grid-column:1/-1"' : ''}><label for="f-${name}">${esc(label)}</label><textarea class="inp ${o.mono ? 'mono' : ''}" id="f-${name}" name="${name}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</div>`,
  select: (name, label, opts, val = '', o = {}) => `<div class="field" ${o.span ? 'style="grid-column:1/-1"' : ''}><label for="f-${name}">${esc(label)}${o.req ? ' *' : ''}</label><select class="inp" id="f-${name}" name="${name}">${opts.map((op) => { const [v, l] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</div>`
};
const opts = (list, none) => (none ? [['', none]] : []).concat(list.map((x) => [x.id, x.name]));

/* ---------- AI sampler (claude.ai artifact; replaced in the standalone build) ---------- */
async function getSampler() { return window.claude ? window.claude.use('sample') : null; }

/* ---------- Downloads + CSV ---------- */
async function saveFile(filename, data) {
  const dl = window.claude ? await window.claude.use('downloads') : null;
  if (!dl) { toast('Downloads aren\'t available in this view. Open the CRM on claude.ai to save files.', 'bad'); return; }
  try { await dl.save({ filename, data }); } catch (e) { if (e && e.code !== 'declined') toast('The file wasn\'t saved.', 'bad'); }
}
function csv(rows) { return rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast('Copy isn\'t available here. Select the text instead.', 'bad'); } }

/* ---------- Branding ---------- */
function applyBrand() {
  const c = /^#[0-9a-f]{6}$/i.test(S.cfg.brand || '') ? S.cfg.brand : DEFAULT_CFG.brand;
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  document.documentElement.style.setProperty('--primary', c);
  document.documentElement.style.setProperty('--primary-fg', lum > 0.55 ? '#0A0A0A' : (lum > 0.42 ? '#0A0A0A' : '#FFFFFF'));
  document.title = (S.cfg.name ? S.cfg.name + ' · ' : '') + 'Operations CRM';
}
const logoHTML = () => (S.cfg.logo ? `<img src="${esc(S.cfg.logo)}" alt="${esc(S.cfg.name)} logo">` : `<span class="mark">${esc(initials(S.cfg.name))}</span>`);

/* ---------- Theme ---------- */
function getTheme() { try { return localStorage.getItem('crm_theme') || 'system'; } catch { return 'system'; } }
function setTheme(t) {
  try { localStorage.setItem('crm_theme', t); } catch {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
