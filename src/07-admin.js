ACT['goto-overdue'] = () => { S.ui['inv.overdue'] = true; S.ui['inv.status'] = 'all'; go('invoices'); };

/* ============ Company settings ============ */
V.company = {
  render() {
    const c = S.cfg, ro = !S.isAdmin;
    const logo = S.ui.logoPending !== undefined ? S.ui.logoPending : c.logo;
    const dis = ro ? 'disabled' : '';
    const inp = (n, l, v, o = {}) => `<div class="field" ${o.span ? 'style="grid-column:1/-1"' : ''}><label for="c-${n}">${esc(l)}</label><input class="inp ${o.mono ? 'num' : ''}" id="c-${n}" name="${n}" type="${o.type || 'text'}" value="${esc(v ?? '')}" placeholder="${esc(o.ph || '')}" ${o.step ? `step="${o.step}"` : ''} ${dis}>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</div>`;
    const ta = (n, l, v, rows = 3, hint = '') => `<div class="field" style="grid-column:1/-1"><label for="c-${n}">${esc(l)}</label><textarea class="inp" id="c-${n}" name="${n}" rows="${rows}" ${dis}>${esc(v)}</textarea>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
    const save = ro ? '' : `<div class="row" style="justify-content:flex-end;padding:14px 20px;border-top:1px solid var(--border)"><button class="btn btn-primary" data-act="cfg-save">${icon('check')}Save settings</button></div>`;
    return pageHead({ eyebrow: 'Configuration', title: 'Company settings', lede: 'Brand, defaults and tax that flow into every quote and invoice.' })
      + (ro ? `<div class="panel pad" style="margin-bottom:16px">${icon('shield')} <span class="small">Only the owner and editors can change company settings.</span></div>` : '')
      + `<div class="stack" id="cfg-form" style="max-width:860px">
      <div class="panel"><div class="panel-h"><div><h2 class="h2">Company info</h2><div class="sub">Used on quotes, invoices and the operations console.</div></div></div><div class="pad grid2">
        ${inp('name', 'Company name', c.name, { span: true })}${inp('tagline', 'Tagline', c.tagline, { span: true, ph: 'General & exterior contracting' })}
        ${inp('phone', 'Phone', c.phone, { type: 'tel', ph: '(555) 555-5555' })}${inp('email', 'Email', c.email, { type: 'email', ph: 'hello@yourcompany.com' })}
        ${inp('address', 'Address', c.address, { ph: '123 Industrial Pkwy, City ON', span: true })}${inp('website', 'Website', c.website, { ph: 'yourcompany.com' })}
        <div class="field"><label for="c-brand">Brand colour</label><div class="row" style="flex-wrap:nowrap"><input type="color" id="c-brandpick" value="${esc(c.brand)}" style="width:48px;height:42px;border:1px solid var(--border);background:var(--card);padding:2px" ${dis} aria-label="Pick brand colour"><input class="inp num" id="c-brand" name="brand" value="${esc(c.brand)}" ${dis}></div><div class="hint">Buttons, highlights and PDF accents.</div></div>
        <div class="field" style="grid-column:1/-1"><label>Logo</label><div class="row"><div class="logo" style="width:140px;height:64px">${logo ? `<img src="${esc(logo)}" alt="Logo preview">` : `<span class="mark" style="font-size:22px">${esc(initials(c.name))}</span>`}</div>${ro ? '' : `<label class="btn btn-sm" for="c-logo">${icon('image')}Upload logo</label><input type="file" id="c-logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>${logo ? btn('Remove', 'cfg-logo-rm', { cls: 'btn-sm btn-ghost' }) : ''}`}</div><div class="hint">PNG or JPG. It's resized to fit; a wide logo on a transparent background looks best.</div></div>
      </div>${save}</div>
      <div class="panel"><div class="panel-h"><div><h2 class="h2">Quote & invoice defaults</h2><div class="sub">Tax rate, numbering, expiry and the text printed on accepted work.</div></div></div><div class="pad grid2">
        ${inp('taxLabel', 'Tax label', c.taxLabel, { ph: 'HST / GST / Sales tax' })}${inp('taxRate', 'Tax rate (%)', c.taxRate, { type: 'number', step: '0.001', mono: true })}
        ${inp('currency', 'Currency symbol', c.currency, { ph: '$' })}${inp('quoteValidity', 'Quote valid for (days)', c.quoteValidity, { type: 'number', mono: true })}
        ${inp('invoiceDueDays', 'Invoice due after (days)', c.invoiceDueDays, { type: 'number', mono: true })}${inp('followUpDays', 'Follow up on sent quotes after (days)', c.followUpDays, { type: 'number', mono: true })}
        ${inp('quotePrefix', 'Quote number prefix', c.quotePrefix, { mono: true })}${inp('invoicePrefix', 'Invoice number prefix', c.invoicePrefix, { mono: true })}
        ${ta('paymentTerms', 'Default payment schedule', c.paymentTerms, 2)}${ta('warranty', 'Default warranty', c.warranty, 3)}
      </div>${save}</div>
      <div class="panel"><div class="panel-h"><div><h2 class="h2">Services & lead sources</h2><div class="sub">One per line. These drive the dropdowns, filters and reports.</div></div></div><div class="pad grid2">
        <div class="field"><label for="c-services">Services you sell</label><textarea class="inp" id="c-services" name="services" rows="10" ${dis}>${esc(c.services.join('\n'))}</textarea></div>
        <div class="field"><label for="c-sources">Lead sources</label><textarea class="inp" id="c-sources" name="sources" rows="10" ${dis}>${esc(c.sources.join('\n'))}</textarea></div>
      </div>${save}</div>
      ${S.isAdmin ? `<div class="panel"><div class="panel-h"><div><h2 class="h2">Example data</h2><div class="sub">Load a realistic set of records, each marked <span class="ex" style="margin:0">EXAMPLE</span>, to try every screen. Remove them in one click before you go live.</div></div></div><div class="pad row">${btn('Load example data', 'demo-load', { icon: 'box' })}${btn('Remove example data', 'demo-clear', { cls: 'btn-danger', icon: 'trash' })}<span class="small muted">${COLS.reduce((n, k) => n + D(k).filter((x) => x.example).length, 0)} example records now</span></div></div>` : ''}
      <div class="panel"><div class="panel-h"><div><h2 class="h2">Your data</h2><div class="sub">Download everything in this CRM as one JSON file for backup or migration.</div></div>${btn('Export all', 'export-all', { cls: 'btn-sm', icon: 'download' })}</div></div>
    </div>`;
  },
  mount() {
    const f = $('#c-logo'); if (f) f.onchange = async () => { const file = f.files[0]; if (!file) return; try { S.ui.logoPending = await resizeImage(file, 480, 200); S.dirty = true; render(); toast('Logo ready. Save settings to apply it.'); } catch { toast('That image couldn\'t be read. Try a PNG or JPG.', 'bad'); } };
    const pick = $('#c-brandpick'); if (pick) pick.oninput = () => { $('#c-brand').value = pick.value; };
    $$('#cfg-form [name]').forEach((el) => el.addEventListener('input', () => { S.dirty = true; }));
  }
};
function resizeImage(file, maxW, maxH) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => { const s = Math.min(1, maxW / img.width, maxH / img.height); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); const png = cv.toDataURL('image/png'); res(png.length < 180000 ? png : cv.toDataURL('image/jpeg', 0.88)); }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
ACT['cfg-logo-rm'] = () => { S.ui.logoPending = ''; S.dirty = true; render(); };
ACT['cfg-save'] = async () => {
  const f = formData($('#cfg-form'));
  const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (!f.name) { toast('Company name is required.', 'bad'); return; }
  const brand = /^#[0-9a-f]{6}$/i.test(f.brand) ? f.brand : S.cfg.brand;
  const cfg = { ...S.cfg, ...f, brand, taxRate: num(f.taxRate), quoteValidity: num(f.quoteValidity) || 30, invoiceDueDays: num(f.invoiceDueDays) || 14, followUpDays: num(f.followUpDays) || 3, services: lines(f.services), sources: lines(f.sources) };
  if (!cfg.services.length) cfg.services = DEFAULT_CFG.services; if (!cfg.sources.length) cfg.sources = DEFAULT_CFG.sources;
  if (S.ui.logoPending !== undefined) cfg.logo = S.ui.logoPending;
  delete cfg.updatedAt;
  await Store.saveCfg(cfg);
  delete S.ui.logoPending; S.dirty = false; toast('Settings saved');
};
ACT['export-all'] = () => saveFile(`crm-export-${todayKey()}.json`, JSON.stringify({ exportedAt: nowISO(), company: S.cfg, ...S.data }, null, 2));

/* ============ Team ============ */
const TEAM_TABS = [['crew', 'Crew members', 'hardhat'], ['rep', 'Sales reps', 'briefcase'], ['sub', 'Subcontractors', 'truck']];
function memberModal(type, m = {}) {
  if (!S.isAdmin) { toast('Only the owner and editors can change the team.', 'bad'); return; }
  const t = m.type || type;
  openModal({ title: m.id ? `Edit ${m.name}` : `Add ${{ crew: 'crew member', rep: 'sales rep', sub: 'subcontractor' }[t]}`,
    body: `<div class="grid2">${F.text('name', t === 'sub' ? 'Company / name' : 'Name', m.name, { req: true, span: true })}
      ${t === 'crew' ? F.select('role', 'Role', [['CREW', 'Crew'], ['CREW_LEAD', 'Crew lead']], m.role || 'CREW') + F.text('hourlyRate', 'Hourly rate', m.hourlyRate ?? '', { type: 'number', step: '0.01', hint: 'Used for payroll and job cost.' }) : ''}
      ${t === 'rep' ? F.text('commissionPct', 'Commission (%)', m.commissionPct ?? '', { type: 'number', step: '0.1', hint: 'Percent of each invoice\'s pre-tax value.' }) : ''}
      ${t === 'sub' ? F.text('trade', 'Trade', m.trade, { ph: 'Excavation, electrical, concrete…' }) : ''}
      ${F.text('phone', 'Phone', m.phone, { type: 'tel' })}${F.text('email', 'Email', m.email, { type: 'email' })}
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="active" ${m.active !== false ? 'checked' : ''}> Active</label></div>`,
    foot: `${m.id ? '<button class="btn btn-danger" id="tm-del" style="margin-right:auto">Remove</button>' : ''}<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="tm-ok">Save</button>`,
    onMount: (md) => { $('#tm-ok', md).onclick = async () => { const f = formData(md); if (!f.name) { toast('Name is required.', 'bad'); return; } const body = { ...f, type: t, role: t === 'crew' ? f.role : t === 'rep' ? 'REP' : 'SUB' }; ['hourlyRate', 'commissionPct'].forEach((k) => { if (k in body) body[k] = num(body[k]); }); if (m.id) await Store.update('team', m.id, body); else await Store.add('team', body); closeModal(); toast('Saved'); }; const d = $('#tm-del', md); if (d) d.onclick = () => confirmBox(`Remove ${m.name}?`, 'Past hours, payments and commissions keep their history but show no name. To keep the name, mark them inactive instead.', 'Remove', async () => { await Store.del('team', m.id); toast('Removed'); }); } });
}
ACT['tm-new'] = (el) => memberModal(el.dataset.type);
ACT['tm-edit'] = (el) => memberModal(null, byId('team', el.dataset.id));
ACT['tm-link'] = async (el) => {
  const id = el.value || null;
  if (!Store.db || !S.me.id) { S.myLink = id; render(); return; }
  try { await Store.db.doc(`data/users/${S.me.id}/profile`).set({ memberId: id || '', updatedAt: nowISO() }); toast(id ? 'Linked to your account' : 'Unlinked'); }
  catch { toast('Couldn\'t save the link. You may have view-only access.', 'bad'); }
};
V.team = {
  render() {
    const tab = UI('team.tab', 'crew');
    if (tab === 'users' && typeof usersTabHTML === 'function') return usersTabHTML();
    const rows = D('team').filter((t) => t.type === tab).sort((a, b) => (a.active === false) - (b.active === false) || String(a.name).localeCompare(String(b.name)));
    const me = myMember();
    const linkCard = S.me.id ? `<div class="panel pad row between" style="margin-bottom:20px"><div style="min-width:0;flex:1 1 300px"><div class="eyebrow">Your account</div><div class="small" style="margin-top:6px">Signed in as <b>${esc(S.me.name || 'you')}</b>${S.isAdmin ? ' · owner/editor access' : ''}. Link yourself to a team record so <b>My Today</b>, payroll and commissions show your own work.</div></div><select class="inp" style="width:260px" data-onchange="tm-link" aria-label="Link my account">${[['', '— Not linked —'], ...team().map((t) => [t.id, `${t.name} · ${ROLES[t.role] || 'Subcontractor'}`])].map(([v, l]) => `<option value="${v}" ${me && me.id === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : '';
    const cols = { crew: ['Role', 'Hourly rate'], rep: ['Role', 'Commission'], sub: ['Trade', 'Balance owed'] }[tab];
    const bal = tab === 'sub' ? payees(rangeOf('all')).subs : [];
    return pageHead({ eyebrow: 'Configuration · Team', title: 'Crew & reps', lede: 'The people who work jobs and the reps who close them, including how each one is paid.', acts: S.isAdmin ? btn('Add ' + { crew: 'crew member', rep: 'rep', sub: 'subcontractor' }[tab], 'tm-new', { cls: 'btn-primary', icon: 'plus', attrs: `data-type="${tab}"` }) : '' })
      + linkCard
      + `<div class="tabs">${(S.mode === 'cloud' ? [['users', 'Login users', 'shield']] : []).map(([k, l, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="ui" data-k="team.tab" data-v="${k}">${icon(i)}${l}</button>`).join('')}${TEAM_TABS.map(([k, l, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="ui" data-k="team.tab" data-v="${k}">${icon(i)}${l} (${D('team').filter((t) => t.type === k).length})</button>`).join('')}</div>
      <div class="panel tablewrap">${!ready('team') ? loadingRows() : rows.length ? `<table class="t"><thead><tr><th>Name</th><th>${cols[0]}</th><th>Phone</th><th>Email</th><th class="r">${cols[1]}</th><th>Status</th></tr></thead><tbody>${rows.map((t) => `<tr class="${S.isAdmin ? 'click' : ''}" ${S.isAdmin ? `data-act="tm-edit" data-id="${t.id}" tabindex="0"` : ''}><td class="cell-main">${esc(t.name)}${exTag(t)}${me && me.id === t.id ? ' <span class="badge c-pri">You</span>' : ''}</td><td>${esc(tab === 'sub' ? t.trade || '—' : ROLES[t.role] || '—')}</td><td>${t.phone ? `<button class="linkbtn" data-act="copy" data-text="${esc(t.phone)}">${esc(t.phone)}</button>` : '—'}</td><td class="small">${esc(t.email || '—')}</td><td class="r num">${tab === 'crew' ? money(t.hourlyRate) + '/h' : tab === 'rep' ? num(t.commissionPct) + '%' : money((bal.find((b) => b.p.id === t.id) || { balance: 0 }).balance)}</td><td>${t.active === false ? '<span class="badge c-grey">Inactive</span>' : '<span class="badge c-ok">Active</span>'}</td></tr>`).join('')}</tbody></table>` : emptyBox(TEAM_TABS.find((x) => x[0] === tab)[2], `No ${TEAM_TABS.find((x) => x[0] === tab)[1].toLowerCase()} yet`, tab === 'crew' ? 'Add crew with their hourly rate so logged hours flow into payroll and job cost.' : tab === 'rep' ? 'Add reps with their commission % so quotes can be attributed and commissions tracked.' : 'Add the subs you hire; record their invoices as Subcontractor expenses.', S.isAdmin ? btn('Add', 'tm-new', { cls: 'btn-primary', icon: 'plus', attrs: `data-type="${tab}"` }) : '')}</div>
      <div class="panel pad" style="margin-top:20px"><div class="eyebrow" style="margin-bottom:8px">Login access</div><p class="small" style="margin:0;max-width:72ch">${S.mode === 'cloud' ? 'People sign in with their email and password. Invite them under <b>Login users</b> and pick a role: <b>Owner</b> or <b>Admin</b> can do everything; <b>Sales rep</b> works leads, quotes and invoices; <b>Crew lead</b> and <b>Crew</b> see projects, hours, expenses and their own pay.' : `People sign in with their own Claude account. Share this CRM from the <b>Share</b> menu: <b>Contributor</b> lets someone work leads, quotes, projects and expenses; <b>Editor</b> also lets them change company settings, the team, overhead and payroll payments. Viewers can't see customer records.`}</p></div>`;
  }
};

/* ============ Example data ============ */
ACT['demo-load'] = async (el) => {
  if (D('leads').some((l) => l.example)) { toast('Example data is already loaded.', 'bad'); return; }
  el.disabled = true; toast('Loading example data…');
  const ex = { example: true };
  const T = {};
  const add = async (col, body) => Store.add(col, { ...ex, ...body });
  const crew = [['Marco Bellini', 'CREW_LEAD', 38], ['Dev Patel', 'CREW', 28], ['Sam Okafor', 'CREW', 26]];
  for (const [name, role, rate] of crew) T[name] = await add('team', { name, type: 'crew', role, hourlyRate: rate, phone: '555-0100', active: true });
  T.rep1 = await add('team', { name: 'Alyssa Chen', type: 'rep', role: 'REP', commissionPct: 5, phone: '555-0140', email: 'alyssa@example.com', active: true });
  T.rep2 = await add('team', { name: 'Jordan Reyes', type: 'rep', role: 'REP', commissionPct: 4, phone: '555-0141', active: true });
  T.sub1 = await add('team', { name: 'Ridgeline Excavation', type: 'sub', role: 'SUB', trade: 'Excavation', phone: '555-0170', active: true });
  T.sub2 = await add('team', { name: 'Brightwire Electric', type: 'sub', role: 'SUB', trade: 'Electrical', phone: '555-0171', active: true });
  const svc = S.cfg.services, src = S.cfg.sources;
  const L = [
    ['Priya Sharma', 'Residential', svc[0], src[0], 'new', T.rep1, -1], ['Tom & Ellen Walsh', 'Residential', svc[1], src[2], 'contacted', T.rep1, 0], ['Northgate Plaza Mgmt', 'Commercial', svc[3], src[0], 'contacted', T.rep2, 2],
    ['Luis Ortega', 'Residential', svc[2], src[1], 'quoted', T.rep2, null], ['Hannah Kim', 'Residential', svc[0], src[1], 'quoted', T.rep1, null], ['Westbrook Storage', 'Industrial', svc[3], src[4], 'quoted', T.rep2, null],
    ['Carmen Diaz', 'Residential', svc[0], src[2], 'quoted', T.rep1, null], ['Greg Thompson', 'Residential', svc[1], src[0], 'quoted', T.rep2, null], ['Maple Court Condos', 'Commercial', svc[2], src[3], 'quoted', T.rep1, null], ['Ben Adeyemi', 'Residential', svc[4], src[5], 'lost', T.rep2, null]
  ];
  const leadIds = [];
  for (const [i, [name, category, service, source, status, repId, fu]] of L.entries()) {
    const fuAt = fu == null ? null : localDT((() => { const d = addDays(new Date(), fu); d.setHours(10, 30, 0, 0); return d; })());
    leadIds.push(await add('leads', { name, category, service, source, status, repId, phone: `555-01${pad(20 + i)}`, email: name.split(' ')[0].toLowerCase() + '@example.com', address: `${100 + i * 17} ${['Maple', 'Oak', 'Birch', 'Cedar', 'Elm'][i % 5]} St`, followUpAt: fuAt, notes: [{ id: uid(), at: nowISO(), text: 'Example lead created to show the workflow.' }], history: [], customer: i >= 6 && i <= 8, createdAt: new Date(Date.now() - (i * 4 + 2) * 86400000).toISOString() }));
  }
  const item = (d, q, u, r, inc) => ({ id: uid(), description: d, qty: q, unit: u, rate: r, included: !!inc });
  const opt = (title, items, acc) => ({ id: uid(), title, description: '', taxType: 'tax', items, accepted: !!acc });
  const Q = [
    [3, 'Interlock driveway — 640 sqft', 'pending', [opt('Standard paver, soldier course border', [item('EXCAVATE 10" & HAUL AWAY', 640, 'sqft', 4.5), item('GRANULAR A BASE 8" COMPACTED', 640, 'sqft', 5.25), item('SUPPLY & INSTALL PAVERS', 640, 'sqft', 12), item('POLYMERIC SAND & SEAL', 1, 'lot', 0, true)]), opt('Premium slab paver', [item('EXCAVATE 10" & HAUL AWAY', 640, 'sqft', 4.5), item('GRANULAR A BASE 8" COMPACTED', 640, 'sqft', 5.25), item('SUPPLY & INSTALL PREMIUM SLAB', 640, 'sqft', 17)])], -5],
    [4, "6'H privacy fence — 80ft + 2 gates", 'follow_up', [opt("4x4 6'H full privacy PT fence @ $55/ft", [item('RIGHT SIDE 30FT — SUPPLY & INSTALL', 30, 'ft', 55), item('LEFT SIDE 30FT — SUPPLY & INSTALL', 30, 'ft', 55), item('BACK 20FT — SUPPLY & INSTALL', 20, 'ft', 55), item('4FT SINGLE GATE W/ HARDWARE', 2, 'ea', 450)])], -12],
    [5, 'Yard resurfacing — 4,200 sqft asphalt', 'new', [opt('Mill & pave 2" HL3', [item('MILL EXISTING 2"', 4200, 'sqft', 1.1), item('SUPPLY & LAY HL3 2" COMPACTED', 4200, 'sqft', 3.9)])], -2],
    [6, 'Front yard fence & gate', 'in_progress', [opt("Cedar 5'H shadowbox", [item('FRONT 46FT — SUPPLY & INSTALL', 46, 'ft', 68), item('DOUBLE DRIVE GATE 10FT', 1, 'ea', 1450), item('REMOVE OLD FENCE & DISPOSAL', 1, 'lot', 650)], true)], -30],
    [7, 'Composite deck 16x14 + stairs', 'paid', [opt('Trex Enhance, aluminum rail', [item('DECK FRAME & FOOTINGS', 224, 'sqft', 22), item('COMPOSITE DECKING SUPPLY & INSTALL', 224, 'sqft', 24), item('ALUMINUM RAILING', 42, 'ft', 85), item('STAIRS 4 RISERS', 1, 'lot', 1850)], true)], -55],
    [8, 'Courtyard interlock repair', 'scheduled', [opt('Lift & relay 900 sqft', [item('LIFT EXISTING PAVERS & STOCKPILE', 900, 'sqft', 3.5), item('REGRADE BASE & COMPACT', 900, 'sqft', 4), item('RELAY PAVERS & POLYMERIC SAND', 900, 'sqft', 6.5)], true)], -20]
  ];
  const qIds = {}, qBodies = {};
  let qNum = parseInt(nextNumber('quotes', 'ref', '').replace(/\D/g, ''), 10), iNum = parseInt(nextNumber('invoices', 'number', '').replace(/\D/g, ''), 10);
  const leadInfo = (i) => ({ phone: `555-01${pad(20 + i)}`, email: L[i][0].split(' ')[0].toLowerCase() + '@example.com', address: `${100 + i * 17} ${['Maple', 'Oak', 'Birch', 'Cedar', 'Elm'][i % 5]} St` });
  for (const [li, title, status, options, ago] of Q) {
    const l = leadInfo(li); const lead = { name: L[li][0], repId: L[li][5] };
    const created = addDays(new Date(), ago);
    const body = { ref: '', status, leadId: leadIds[li], repId: lead.repId, client: { name: lead.name, phone: l.phone || '', email: l.email || '', address: l.address || '' }, category: L[li][1], service: L[li][2], source: L[li][3], title, subtitle: '', siteAddress: l.address || '', description: 'Scope as discussed on site. Includes cleanup and disposal unless noted.', options, discount: { type: 'none', value: 0, label: '', applies: 'pre' }, includeWarranty: true, warranty: S.cfg.warranty, terms: S.cfg.paymentTerms, validityDays: 30, notes: '', activity: [{ at: created.toISOString(), text: 'Quote created' }], createdAt: created.toISOString() };
    if (status !== 'new') { body.sentAt = addDays(created, 1).toISOString(); body.expiresAt = dkey(addDays(created, 31)); }
    if (['pending', 'follow_up'].includes(status)) body.followUpAt = localDT((() => { const d = addDays(new Date(), status === 'follow_up' ? -1 : 0); d.setHours(11, 0, 0, 0); return d; })());
    body.ref = S.cfg.quotePrefix + (qNum++);
    qIds[li] = await add('quotes', body); qBodies[li] = { ...body, id: qIds[li] };
  }
  const projSpec = [[6, 'in_progress', -6, 4, [[T['Marco Bellini'], -6, 8], [T['Dev Patel'], -6, 8], [T['Marco Bellini'], -5, 9], [T['Sam Okafor'], -5, 8], [T['Marco Bellini'], -1, 7]]], [7, 'completed', -40, -36, [[T['Marco Bellini'], -40, 9], [T['Dev Patel'], -40, 9], [T['Marco Bellini'], -39, 9], [T['Dev Patel'], -39, 9], [T['Sam Okafor'], -38, 8], [T['Marco Bellini'], -37, 6]]], [8, 'scheduled', 3, 5, []]];
  for (const [li, pstatus, s, e, labor] of projSpec) {
    const q = qBodies[li]; if (!q) continue;
    const c = quoteCalcs(q); const lines = [{ label: 'Option A', title: q.options[0].title, description: '', taxType: 'tax', items: q.options[0].items, ...c[0] }];
    const issue = keyPlus(s - 7);
    const total = c[0].total; const payments = pstatus === 'completed' ? [{ id: uid(), amount: round2(total * 0.4), date: issue, method: 'E-transfer', note: 'Deposit' }, { id: uid(), amount: round2(total - round2(total * 0.4)), date: keyPlus(e + 2), method: 'Cheque', note: 'Balance' }] : pstatus === 'in_progress' ? [{ id: uid(), amount: round2(total * 0.4), date: issue, method: 'E-transfer', note: 'Deposit' }] : [];
    const invId = await add('invoices', { number: S.cfg.invoicePrefix + (iNum++), quoteId: q.id, quoteRef: q.ref, leadId: q.leadId, repId: q.repId, client: q.client, siteAddress: q.siteAddress, title: q.title, issueDate: issue, dueDate: pstatus === 'scheduled' ? keyPlus(-3) : keyPlus(s + 7), lines, subtotal: c[0].sub, discount: 0, tax: c[0].tax, total, payments, terms: q.terms, warranty: q.warranty, void: false });
    const pid = await add('projects', { title: q.title, client: q.client, siteAddress: q.siteAddress, description: q.description, status: pstatus, start: keyPlus(s), end: keyPlus(e), crew: [...new Set(labor.map((x) => x[0]))].concat(pstatus === 'scheduled' ? [T['Marco Bellini'], T['Sam Okafor']] : []), labor: labor.map(([m, d, h]) => ({ id: uid(), memberId: m, date: keyPlus(d), hours: h, rate: (crew.find((c) => T[c[0]] === m) || [0, 0, 30])[2] })), leadId: q.leadId, quoteId: q.id, invoiceId: invId, notes: '' });
    await Store.update('invoices', invId, { projectId: pid }); await Store.update('quotes', q.id, { invoiceId: invId, projectId: pid });
    T['p' + li] = pid;
  }
  const exps = [[T.p6, 'Materials', 'Cedar boards & posts — Home Depot', 'Home Depot', 2148.6, 247.2, -6], [T.p6, 'Dump', 'Old fence disposal', 'Green Lane Transfer', 180, 20.71, -5], [T.p6, 'Rental', 'Auger rental 2 days', 'Sunbelt', 220.35, 25.35, -6], [T.p7, 'Materials', 'Trex Enhance boards & hidden fasteners', 'Lumber yard', 4980, 572.92, -41], [T.p7, 'Materials', 'Aluminum rail kit', 'Railing Depot', 2306.5, 265.35, -39], [T.p7, 'Subcontractor', 'Footing excavation', '', 1130, 130, -41, T.sub1], [T.p7, 'Permits', 'Deck permit', 'City', 312, 0, -45], [T.p8, 'Materials', 'Polymeric sand ×24, base stone', 'Stone yard', 1415.6, 162.86, -1], ['', 'Gas', 'Truck fuel — week', 'Petro', 186.4, 21.44, -3], ['', 'Equipment', 'Plate compactor service', 'Tool repair', 245, 28.19, -12]];
  for (const [projectId, category, description, vendor, amount, hst, d, subId] of exps) await add('expenses', { projectId: projectId || '', category, description, vendor, amount, hst, date: keyPlus(d), subId: subId || '' });
  for (const [name, category, monthly] of [['Shop & yard rent', 'Rent', 2400], ['Truck lease ×2', 'Vehicles', 1650], ['Liability & WSIB', 'Insurance', 980], ['Software & phones', 'Software', 240], ['Google & Meta ads', 'Marketing', 1200]]) await add('overhead', { name, category, monthly });
  await add('payouts', { payeeId: T['Marco Bellini'], payeeType: 'crew', amount: 1500, date: keyPlus(-30), method: 'E-transfer', note: 'Pay period' });
  await add('payouts', { payeeId: T['Dev Patel'], payeeType: 'crew', amount: 504, date: keyPlus(-30), method: 'E-transfer', note: 'Pay period' });
  el.disabled = false; toast('Example data loaded. Look for the EXAMPLE tags.'); go('dashboard');
};
ACT['demo-clear'] = () => confirmBox('Remove all example data?', 'Every record tagged EXAMPLE is deleted. Your own records stay.', 'Remove example data', async () => {
  const jobs = COLS.flatMap((c) => D(c).filter((x) => x.example).map((x) => [c, x.id]));
  if (!jobs.length) { toast('No example data to remove.'); return; }
  toast(`Removing ${jobs.length} example records…`);
  let i = 0; const worker = async () => { while (i < jobs.length) { const [c, id] = jobs[i++]; await Store.del(c, id); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  toast('Example data removed');
});

/* ============ AI assistant (sample capability, page tools) ============ */
S.ai = [];
function aiRow(c, x) {
  if (c === 'leads') return { id: x.id, name: x.name, status: x.status, customer: !!x.customer, source: x.source, service: x.service, rep: pname(x.repId), phone: x.phone, followUpAt: x.followUpAt, created: String(x.createdAt).slice(0, 10) };
  if (c === 'quotes') return { id: x.id, ref: x.ref, client: x.client && x.client.name, title: x.title, status: quoteStatus(x), value: quoteValue(x), rep: pname(x.repId), created: String(x.createdAt).slice(0, 10), followUpAt: x.followUpAt };
  if (c === 'invoices') return { id: x.id, number: x.number, client: x.client && x.client.name, total: x.total, paid: invPaid(x), due: invDue(x), status: invStatus(x), dueDate: x.dueDate, daysOverdue: invOverdueDays(x) };
  if (c === 'projects') { const f = projectFin(x); return { id: x.id, title: x.title, status: x.status, start: x.start, end: x.end, crew: (x.crew || []).map(pname), revenue: round2(f.revenue), cost: round2(f.cost), profit: round2(f.profit), margin: f.margin == null ? null : round2(f.margin * 100) }; }
  if (c === 'expenses') return { date: x.date, category: x.category, description: x.description, project: (byId('projects', x.projectId) || {}).title || 'overhead', amount: x.amount };
  if (c === 'team') return { name: x.name, type: x.type, role: x.role, hourlyRate: x.hourlyRate, commissionPct: x.commissionPct, active: x.active !== false };
  return x;
}
const AI_TOOLS = [
  { name: 'find_records', description: 'Search CRM records. Returns compact rows. Use status values exactly as stored (leads: new|contacted|quoted|lost; quotes: new|pending|approved|scheduled|in_progress|paid|follow_up|lost|expired; invoices: pending|partial|paid|void; projects: pending|scheduled|in_progress|on_hold|completed|cancelled).',
    inputSchema: { type: 'object', properties: { collection: { type: 'string', enum: ['leads', 'quotes', 'invoices', 'projects', 'expenses', 'team'] }, text: { type: 'string', description: 'Optional case-insensitive text to match on names, titles, refs' }, status: { type: 'string' }, limit: { type: 'number' } }, required: ['collection'] },
    execute: ({ collection, text, status, limit }) => { if (!COLS.includes(collection)) throw new Error('unknown collection'); const rows = D(collection).map((x) => aiRow(collection, x)).filter((r) => (!status || r.status === status) && (!text || JSON.stringify(r).toLowerCase().includes(String(text).toLowerCase()))); return { total: rows.length, rows: rows.slice(0, Math.min(60, num(limit) || 25)) }; } },
  { name: 'business_metrics', description: 'Financial summary between two dates (YYYY-MM-DD): invoiced revenue, tax, labour, subcontractors, materials, commissions, gross profit, overhead, outstanding receivables, open pipeline.',
    inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
    execute: ({ from, to }) => { const r = { from, to }; const inv = D('invoices').filter((i) => !i.void && inR(i.issueDate, r)); const rev = sum(inv, invNet); const labor = sum(D('projects').flatMap((p) => (p.labor || []).filter((l) => inR(l.date, r))), (l) => num(l.hours) * num(l.rate)); const subs = sum(D('expenses').filter((e) => e.category === 'Subcontractor' && inR(e.date, r)), expNet); const mats = sum(D('expenses').filter((e) => e.projectId && !['Subcontractor', 'Labor'].includes(e.category) && inR(e.date, r)), expNet); const comm = sum(inv, (i) => invCommission(i).amount); return { invoicedPreTax: round2(rev), taxCollected: round2(sum(inv, (i) => i.tax)), labor: round2(labor), subcontractors: round2(subs), materialsAndOther: round2(mats), commissions: round2(comm), grossProfit: round2(rev - labor - subs - mats - comm), overheadPerMonth: round2(sum(D('overhead'), (o) => o.monthly)), receivablesOutstanding: round2(sum(D('invoices').filter(invOpen), invDue)), openPipeline: round2(sum(D('quotes').filter((q) => ['pending', 'follow_up'].includes(quoteStatus(q))), quoteValue)) }; } }
];
function toggleAI(force) {
  const open = $('#ai-panel');
  if (open && force !== true) { open.remove(); return; }
  if (open) return;
  const p = document.createElement('div'); p.className = 'ai-panel'; p.id = 'ai-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'AI assistant');
  p.innerHTML = `<div class="panel-h"><div class="row"><span class="ai-ic">${icon('sparkles')}</span><div><div class="eyebrow accent">AI assistant</div><div class="xs muted">Asks Claude about your CRM data</div></div></div><button class="iconbtn" id="ai-x" aria-label="Close">${icon('x')}</button></div><div class="ai-msgs" id="ai-msgs"></div><form id="ai-form" class="row" style="padding:12px;border-top:1px solid var(--border);flex-wrap:nowrap"><input class="inp" id="ai-in" placeholder="Which quotes need a call today?" autocomplete="off" aria-label="Ask a question"><button class="btn btn-primary" style="padding:0 14px" aria-label="Send">${icon('send')}</button></form>`;
  document.body.appendChild(p);
  $('#ai-x').onclick = () => p.remove();
  $('#ai-form').onsubmit = (e) => { e.preventDefault(); const v = $('#ai-in').value.trim(); if (v) { $('#ai-in').value = ''; askAI(v); } };
  drawAI(); setTimeout(() => $('#ai-in').focus(), 30);
}
function drawAI(stream) {
  const box = $('#ai-msgs'); if (!box) return;
  const msgs = S.ai.length ? S.ai : [{ role: 'assistant', content: 'Ask about your pipeline, jobs or money. For example:\n• Which quotes are waiting on a follow-up?\n• What was our gross margin this month?\n• Which invoices are overdue and by how much?' }];
  box.innerHTML = msgs.map((m) => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}">${esc(m.content)}</div>`).join('') + (stream != null ? `<div class="msg a">${esc(stream || 'Thinking…')}</div>` : '');
  box.scrollTop = box.scrollHeight;
}
let aiBusy = false;
async function askAI(q) {
  if (aiBusy) return;
  const sample = await getSampler();
  S.ai.push({ role: 'user', content: q });
  if (!sample) { S.ai.push({ role: 'assistant', content: 'The AI assistant isn\'t available in this view. Open the CRM on claude.ai to use it.' }); drawAI(); return; }
  aiBusy = true; drawAI('');
  const ctx = `You are the operations assistant inside the CRM of ${S.cfg.name}, a construction company. Today is ${todayKey()}. Currency ${S.cfg.currency}; tax ${S.cfg.taxLabel} ${S.cfg.taxRate}%. Records marked example are sample data. Use the tools to look things up; never guess figures. Answer briefly in plain text (no markdown tables), with names, refs and amounts.`;
  const msgs = S.ai.slice(-12).map((m, i) => ({ role: m.role, content: i === 0 && m.role === 'user' ? ctx + '\n\nQuestion: ' + m.content : m.content }));
  if (msgs[0].role !== 'user') msgs.shift();
  if (!msgs[0].content.startsWith('You are')) msgs[0] = { role: 'user', content: ctx + '\n\n' + msgs[0].content };
  try {
    const r = await sample(msgs, { tools: AI_TOOLS, cache: false, onText: ({ text }) => drawAI(text) });
    S.ai.push({ role: 'assistant', content: r.text || '(no answer)' });
  } catch (e) {
    S.ai.push({ role: 'assistant', content: e && e.code === 'not_granted' ? 'AI is turned off for this page.' : e && e.code === 'rate_limited' ? 'Too many questions at once. Try again in a minute.' : 'I couldn\'t answer that just now. Try again.' });
  } finally { aiBusy = false; drawAI(); }
}

/* ============ Boot ============ */
function computeRole() {
  if (S.mode !== 'live' || S.isAdmin) { S.role = 'OWNER'; return; }
  const m = myMember();
  S.role = !m ? 'REP' : m.type === 'crew' ? (m.role || 'CREW') : m.type === 'rep' ? 'REP' : 'CREW';
}
let nameTimer = null;
function resolveNames(user) {
  clearTimeout(nameTimer);
  nameTimer = setTimeout(async () => {
    const ids = new Set(); D('leads').forEach((l) => (l.notes || []).forEach((n) => n.by && !S.names[n.by] && ids.add(n.by)));
    if (!ids.size) return;
    try { const ps = await user.profiles([...ids]); let ch = false; ids.forEach((id) => { const n = ps[id] && ps[id].name; S.names[id] = n || 'Teammate'; ch = true; }); if (ch && S.route === 'lead') scheduleRender(); } catch {}
  }, 400);
}
async function boot() {
  setTheme(getTheme());
  applyBrand(); readHash(); render();
  const c = window.claude;
  let db = null, user = null;
  if (c && typeof c.use === 'function') { try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch { db = null; } }
  if (user) {
    try {
      S.me.id = await user.id(); const me = await user.me(); S.me.name = (me && me.name) || '';
      const [own, edit, w] = await Promise.all([user.isOwner(), user.canEdit(), user.can('data.write')]);
      S.isAdmin = !!(own || edit); S.canWrite = w !== false;
    } catch {}
  }
  if (!db) { S.mode = 'local'; COLS.forEach((k) => (S.loaded[k] = true)); S.isAdmin = true; render(); return; }
  Store.db = db; S.mode = 'live'; S.isAdmin = S.isAdmin || false;
  const timer = setTimeout(() => { if (COLS.some((k) => !S.loaded[k])) { S.stale = true; render(); } }, 10000);
  COLS.forEach((k) => db.collection(k).onSnapshot((snap) => {
    S.data[k] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!snap.metadata.fromCache || snap.size) S.loaded[k] = true;
    if (COLS.every((x) => S.loaded[x]) && S.stale) { S.stale = false; clearTimeout(timer); }
    if (k === 'leads' && user) resolveNames(user);
    scheduleRender();
  }, (err) => { console.warn('db', k, err); S.loaded[k] = true; if (err && err.code === 'revoked') S.canWrite = false; scheduleRender(); }));
  db.doc('config/company').onSnapshot((s) => { if (s.exists) S.cfg = { ...DEFAULT_CFG, ...s.data() }; applyBrand(); S.loaded.cfg = true; scheduleRender(); }, () => {});
  if (S.me.id) db.doc(`data/users/${S.me.id}/profile`).onSnapshot((s) => { S.myLink = (s.exists && s.data().memberId) || null; scheduleRender(); }, () => {});
}
