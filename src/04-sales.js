/* ============ Dashboard ============ */
function activeToday(p) { const t = todayKey(); return p.start && p.start <= t && (p.end || p.start) >= t && !['cancelled', 'completed', 'on_hold'].includes(p.status); }
function followItems() {
  const now = new Date();
  const items = [];
  D('leads').forEach((l) => { if (!l.customer && ['new', 'contacted'].includes(l.status || 'new') && l.followUpAt) items.push({ kind: 'leads', id: l.id, name: l.name, phone: l.phone, email: l.email, address: l.address, due: l.followUpAt, repId: l.repId, snoozed: l.snoozed, rec: l, sub: [l.service, l.source].filter(Boolean).join(' · ') }); });
  D('quotes').forEach((q) => { const st = quoteStatus(q); if (['pending', 'follow_up', 'expired'].includes(st) && q.followUpAt) items.push({ kind: 'quotes', id: q.id, name: (q.client && q.client.name) || quoteTitle(q), phone: q.client && q.client.phone, email: q.client && q.client.email, due: q.followUpAt, repId: q.repId, snoozed: q.snoozed, rec: q, sub: `${q.ref || ''} · ${money0(quoteValue(q))} · ${statusMeta(QUOTE_STATUS, st)[1]}` }); });
  D('invoices').forEach((i) => { if (invOpen(i)) { const due = i.followUpAt || i.dueDate; if (due) items.push({ kind: 'invoices', id: i.id, name: (i.client && i.client.name) || i.number, phone: i.client && i.client.phone, email: i.client && i.client.email, due, repId: i.repId, snoozed: i.snoozed, rec: i, sub: `${i.number} · ${money(invDue(i))} due` }); } });
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t1 = addDays(t0, 1), t7 = addDays(t0, 8);
  items.forEach((it) => {
    const d = toDate(it.due);
    it.bucket = it.snoozed && d > now ? 'snoozed' : d < t0 ? 'overdue' : d < t1 ? 'today' : d < t7 ? 'week' : 'later';
  });
  return items.sort((a, b) => String(a.due).localeCompare(String(b.due)));
}
function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

V.dashboard = {
  render() {
    const first = (S.me.name || '').split(' ')[0];
    const head = pageHead({ eyebrow: 'Console · Overview', title: `${greet()}${first ? ', ' + first : ''}.`, lede: `${esc(S.cfg.name)} · ${fmtDate(todayKey(), { weekday: 'long', month: 'long', day: 'numeric' })}`, acts: S.role === 'CREW' || S.role === 'CREW_LEAD' ? btn('My Today', null, { go: 'today', icon: 'listchecks' }) : `${btn('New quote', null, { go: 'quote', param: 'new', icon: 'briefcase' })}${btn('Add lead', 'lead-new', { cls: 'btn-primary', icon: 'plus' })}` });
    if (!ready('leads', 'quotes', 'invoices', 'projects')) return head + `<div class="panel">${loadingRows()}</div>`;
    const setup = this.setup();
    if (S.role === 'CREW' || S.role === 'CREW_LEAD') return head + setup + this.crew();
    const r = rangeOf('mtd');
    const open = D('quotes').filter((q) => ['pending', 'follow_up'].includes(quoteStatus(q)));
    const invM = D('invoices').filter((i) => !i.void && inR(i.issueDate, r));
    const openInv = D('invoices').filter(invOpen);
    const overdue = openInv.filter((i) => invOverdueDays(i) > 0);
    const fins = D('projects').filter((p) => p.invoiceId && invM.some((i) => i.id === p.invoiceId)).map(projectFin);
    const rev = sum(fins, (f) => f.revenue), prof = sum(fins, (f) => f.profit);
    const tiles = `<div class="tiles" style="margin-bottom:20px">
      <div class="tile" style="--c:var(--warn)"><div class="k">Open pipeline</div><div class="v">${money0(sum(open, quoteValue))}</div><div class="s">${open.length} quote${open.length === 1 ? '' : 's'} pending or in follow-up</div></div>
      <div class="tile" style="--c:var(--info)"><div class="k">Invoiced this month</div><div class="v">${money0(sum(invM, (i) => i.total))}</div><div class="s">${invM.length} invoice${invM.length === 1 ? '' : 's'} · includes ${esc(S.cfg.taxLabel)}</div></div>
      <div class="tile" style="--c:var(--danger)"><div class="k">Awaiting payment</div><div class="v">${money0(sum(openInv, invDue))}</div><div class="s">${overdue.length ? `<b style="color:var(--danger)">${overdue.length} overdue</b> · ` : ''}${openInv.length} open</div></div>
      <div class="tile" style="--c:var(--ok)"><div class="k">Gross margin · MTD</div><div class="v">${rev ? pct(prof / rev) : '—'}</div><div class="s">${rev ? money0(prof) + ' profit on ' + money0(rev) : 'No invoiced jobs this month yet'}</div></div>
    </div>`;
    const todayJobs = D('projects').filter(activeToday);
    const fu = followItems().filter((x) => x.bucket === 'overdue' || x.bucket === 'today');
    const sched = `<div class="panel"><div class="panel-h"><div><h2 class="h2">Today's schedule</h2><div class="sub">${todayJobs.length} active job${todayJobs.length === 1 ? '' : 's'}</div></div><button class="btn btn-sm" data-go="calendar">${icon('calendar')}Calendar</button></div>
      ${todayJobs.length ? `<div class="list">${todayJobs.slice(0, 6).map((p) => `<div class="li click" data-go="project" data-param="${p.id}" tabindex="0"><div class="grow"><div class="strong trunc">${esc(p.title)}${exTag(p)}</div><div class="xs muted trunc">${esc(p.siteAddress || (p.client && p.client.name) || '')}</div></div>${badge(PROJECT_STATUS, p.status)}</div>`).join('')}</div>` : '<div class="mini-empty">No jobs scheduled today.</div>'}</div>`;
    const fuP = `<div class="panel"><div class="panel-h"><div><h2 class="h2">Follow-ups due</h2><div class="sub">${fu.filter((x) => x.bucket === 'overdue').length} overdue · ${fu.filter((x) => x.bucket === 'today').length} today</div></div><button class="btn btn-sm" data-go="followups">${icon('phone')}Queue</button></div>
      ${fu.length ? `<div class="list">${fu.slice(0, 6).map((x) => `<div class="li click" data-go="${x.kind.slice(0, -1)}" data-param="${x.id}" tabindex="0"><div class="grow"><div class="strong trunc">${esc(x.name)}${exTag(x.rec)}</div><div class="xs muted trunc">${esc(x.kind.slice(0, -1))} · ${esc(x.sub)}</div></div><span class="badge ${x.bucket === 'overdue' ? 'c-bad' : 'c-warn'}">${x.bucket === 'overdue' ? 'Overdue' : 'Today'}</span></div>`).join('')}</div>` : '<div class="mini-empty">All clear. Nobody is waiting on a call back.</div>'}</div>`;
    const r30 = rangeOf('30d');
    const leads30 = D('leads').filter((l) => inR(l.createdAt, r30));
    const srcs = S.cfg.sources.map((s) => [s, leads30.filter((l) => l.source === s).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const mx = Math.max(1, ...srcs.map((x) => x[1]));
    const src = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Pipeline · Lead source</div><h2 class="h2" style="margin-top:4px">Where leads are coming from</h2></div><span class="xs muted">Last 30 days</span></div>${srcs.length ? `<div class="bars">${srcs.map(([s, n]) => `<div class="bar"><span class="trunc">${esc(s)}</span><div class="track"><div class="fill" style="width:${(n / mx) * 100}%"></div></div><span class="num r small">${n}</span></div>`).join('')}</div>` : '<div class="mini-empty">No leads in this window yet.</div>'}</div>`;
    const pf = D('projects').map((p) => ({ p, f: projectFin(p) })).filter((x) => x.f.revenue > 0);
    const top = pf.filter((x) => x.f.margin != null).sort((a, b) => b.f.margin - a.f.margin).slice(0, 5);
    const topP = `<div class="panel"><div class="panel-h"><h2 class="h2">Most profitable jobs (%)</h2><button class="btn btn-sm" data-go="profit">Analysis</button></div>${top.length ? `<div class="list">${top.map(({ p, f }) => `<div class="li click" data-go="project" data-param="${p.id}" tabindex="0"><div class="grow"><div class="strong trunc">${esc(p.title)}${exTag(p)}</div><div class="xs muted">${money0(f.profit)} profit on ${money0(f.revenue)}</div></div><span class="num strong" style="color:var(--ok)">${pct(f.margin)}</span></div>`).join('')}</div>` : '<div class="mini-empty">No projects with revenue yet.</div>'}</div>`;
    const watch = pf.filter((x) => !['completed', 'cancelled'].includes(x.p.status) && x.f.cost > 0 && x.f.margin < 0.2);
    const watchP = `<div class="panel"><div class="panel-h"><h2 class="h2">Margin watchlist</h2><span class="xs muted">Active jobs under 20%</span></div>${watch.length ? `<div class="list">${watch.map(({ p, f }) => `<div class="li click" data-go="project" data-param="${p.id}" tabindex="0"><div class="grow"><div class="strong trunc">${esc(p.title)}</div><div class="xs muted">${money0(f.cost)} spent of ${money0(f.revenue)}</div></div><span class="num strong" style="color:var(--danger)">${pct(f.margin)}</span></div>`).join('')}</div>` : '<div class="mini-empty">All active projects are healthy.</div>'}</div>`;
    const recent = [...D('leads').map((x) => ['lead', x, x.name]), ...D('quotes').map((x) => ['quote', x, `${x.ref || ''} ${quoteTitle(x)}`]), ...D('invoices').map((x) => ['invoice', x, `${x.number} ${(x.client && x.client.name) || ''}`]), ...D('projects').map((x) => ['project', x, x.title])]
      .sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt))).slice(0, 8);
    const act = `<div class="panel"><div class="panel-h"><h2 class="h2">Recent activity</h2></div>${recent.length ? `<div class="list">${recent.map(([k, x, t]) => `<div class="li click" data-go="${k}" data-param="${x.id}" tabindex="0"><span class="badge c-grey">${k}</span><div class="grow trunc">${esc(t)}</div><span class="xs muted">${ago(x.updatedAt)}</span></div>`).join('')}</div>` : '<div class="mini-empty">Nothing yet. Add your first lead to get started.</div>'}</div>`;
    return head + setup + tiles + `<div class="grid2">${sched}${fuP}${src}${topP}${watchP}${act}</div>`;
  },
  setup() {
    const steps = [
      ['company', 'Add your company name, logo and tax rate', S.cfg.updatedAt],
      ['team', 'Add your crew, sales reps and subcontractors', D('team').length > 0],
      ['leads', 'Capture your first lead', D('leads').length > 0]
    ];
    if (steps.every((s) => s[2]) || !S.isAdmin) return '';
    return `<div class="panel" style="margin-bottom:20px;border-color:color-mix(in srgb,var(--primary) 45%,var(--border))"><div class="panel-h"><div><div class="eyebrow accent">Get set up</div><h2 class="h2" style="margin-top:4px">Make this CRM yours</h2></div><button class="btn btn-sm" data-go="company">${icon('box')}Try it with example data</button></div>
      <div class="list">${steps.map(([r, t, done]) => `<div class="li click" data-go="${r}" tabindex="0"><span class="badge ${done ? 'c-ok' : 'c-grey'}">${done ? 'Done' : 'To do'}</span><div class="grow">${esc(t)}</div>${icon('arrowR')}</div>`).join('')}</div></div>`;
  },
  crew() {
    const m = myMember();
    const mine = (p) => !m || (p.crew || []).includes(m.id);
    const jobs = D('projects').filter((p) => activeToday(p) && mine(p));
    const wk = rangeOf('week');
    const hrs = m ? sum(D('projects').flatMap((p) => (p.labor || []).filter((l) => l.memberId === m.id && inR(l.date, wk))), (l) => l.hours) : 0;
    return `<div class="tiles" style="margin-bottom:20px"><div class="tile"><div class="k">Jobs today</div><div class="v">${jobs.length}</div><div class="s">${m ? 'Assigned to you' : 'Link your account in Team to see only your jobs'}</div></div><div class="tile" style="--c:var(--info)"><div class="k">Pay-period hours</div><div class="v">${hrs.toFixed(1)}</div><div class="s">This week</div></div></div>
      <div class="panel"><div class="panel-h"><h2 class="h2">Today's schedule</h2></div>${jobs.length ? `<div class="list">${jobs.map((p) => `<div class="li click" data-go="project" data-param="${p.id}"><div class="grow"><div class="strong">${esc(p.title)}</div><div class="xs muted">${esc(p.siteAddress || '')}</div></div>${badge(PROJECT_STATUS, p.status)}</div>`).join('')}</div>` : '<div class="mini-empty">No jobs scheduled today. Enjoy your day.</div>'}</div>`;
  }
};

/* ============ Leads ============ */
function leadForm(l = {}) {
  const reps = repList();
  return `<div class="grid2">
    ${F.select('category', 'Category', CATEGORIES, l.category || 'Residential', { span: true })}
    ${F.text('name', 'Client name', l.name, { req: true, span: true })}
    ${F.select('service', 'Service interest', [['', '— Select a service —'], ...S.cfg.services], l.service || '', { span: true, hint: 'Helps route this lead to the right rep and track which services sell.' })}
    ${F.text('phone', 'Phone', l.phone, { type: 'tel', ph: '+1-905-555-0100' })}
    ${F.text('email', 'Email', l.email, { type: 'email', ph: 'client@example.com' })}
    ${F.text('address', 'Address', l.address, { ph: 'Street, City', span: true })}
    ${F.select('source', 'Source', S.cfg.sources, l.source || S.cfg.sources[0], { req: true })}
    ${F.select('status', 'Status', LEAD_STATUS.map((s) => [s[0], s[1]]), l.status || 'new')}
    ${F.select('repId', 'Source rep', opts(reps, '— None —'), l.repId || '')}
    ${F.text('followUpAt', 'Follow-up', l.followUpAt || '', { type: 'datetime-local' })}
    ${l.id ? '' : F.area('note', 'First note', '', { ph: 'What do they want, budget, timing, access…', rows: 2 })}
  </div>`;
}
function leadModal(lead) {
  openModal({
    title: lead ? 'Edit lead' : 'Add a new lead', body: leadForm(lead || {}),
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="lead-save">${lead ? 'Save lead' : 'Add lead'}</button>`,
    onMount: (m) => {
      $('#lead-save', m).onclick = async () => {
        const f = formData(m);
        if (!f.name) { toast('Client name is required.', 'bad'); $('#f-name', m).focus(); return; }
        const note = f.note; delete f.note;
        if (lead) { await Store.update('leads', lead.id, f); closeModal(); toast('Lead saved'); }
        else {
          const id = await Store.add('leads', { ...f, notes: note ? [{ id: uid(), at: nowISO(), by: S.me.id, text: note }] : [], history: [], customer: false });
          closeModal(); toast('Lead added'); go('lead', id);
        }
      };
    }
  });
}
ACT['lead-new'] = () => leadModal();
ACT['lead-edit'] = (el) => leadModal(byId('leads', el.dataset.id));
ACT['lead-del'] = (el) => confirmBox('Delete this lead?', 'The lead and its notes will be removed. Quotes and invoices already created stay.', 'Delete lead', async () => { await Store.del('leads', el.dataset.id); toast('Lead deleted'); go('leads'); });
ACT['lead-status'] = async (el) => { await Store.update('leads', el.dataset.id, { status: el.value }); toast('Status updated'); };
ACT['lead-note'] = async (el) => {
  const ta = $('#note-text'); const text = ta.value.trim(); if (!text) return;
  const l = byId('leads', el.dataset.id);
  await Store.update('leads', l.id, { notes: [...(l.notes || []), { id: uid(), at: nowISO(), by: S.me.id, text }] });
  ta.value = ''; toast('Note added');
};
ACT['leads-csv'] = () => saveFile(`leads-${todayKey()}.csv`, csv([['Name', 'Category', 'Service', 'Phone', 'Email', 'Address', 'Source', 'Status', 'Rep', 'Follow-up', 'Created'], ...D('leads').map((l) => [l.name, l.category, l.service, l.phone, l.email, l.address, l.source, l.status, pname(l.repId), l.followUpAt, fmtDate(l.createdAt)])]));

function fuFilter(v, due) {
  if (!v || v === 'any') return true;
  if (v === 'none') return !due;
  if (!due) return false;
  const d = toDate(due), t0 = new Date(new Date().toDateString());
  if (v === 'overdue') return d < t0;
  if (v === 'today') return d >= t0 && d < addDays(t0, 1);
  if (v === 'week') return d >= t0 && d < addDays(t0, 8);
  return true;
}
const FU_OPTS = [['any', 'Any follow-up'], ['overdue', 'Overdue'], ['today', 'Due today'], ['week', 'Next 7 days'], ['none', 'No follow-up set']];
const fuCell = (due) => { if (!due) return '<span class="muted">—</span>'; const late = toDate(due) < new Date(); return `<span class="${late ? '' : ''}" style="${late ? 'color:var(--danger);font-weight:700' : ''}">${fmtDT(due)}</span>`; };

V.leads = {
  render() {
    const st = UI('leads.status', 'all'), src = UI('leads.src', 'all');
    return pageHead({ eyebrow: 'Pipeline · Leads', title: 'Lead intake', lede: 'Capture, qualify and route inbound jobs. Click a row to drill in.', acts: btn('Export CSV', 'leads-csv', { icon: 'download' }) + btn('Add lead', 'lead-new', { cls: 'btn-primary', icon: 'plus' }) })
      + `<div class="panel filters"><div class="frow">${searchBox('leads.q', 'Search name, phone, email, address')}
        <select class="inp" style="width:200px" data-fsel="leads.rep" aria-label="Rep">${[['all', 'All reps'], ...repList().map((r) => [r.id, r.name]), ['none', 'Unassigned']].map(([v, l]) => `<option value="${v}" ${UI('leads.rep', 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select class="inp" style="width:200px" data-fsel="leads.fu" aria-label="Follow-up">${FU_OPTS.map(([v, l]) => `<option value="${v}" ${UI('leads.fu', 'any') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fcols"><div><div class="lbl">Status</div>${chips('leads.status', [['all', 'All'], ...LEAD_STATUS], st, { reset: 'leads.page' })}</div>
        <div><div class="lbl">Source</div>${chips('leads.src', [['all', 'All'], ...S.cfg.sources.map((s) => [s, s])], src, { reset: 'leads.page' })}</div></div></div>
        <div id="results">${this.results()}</div>`;
  },
  results() {
    if (!ready('leads')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const st = UI('leads.status', 'all'), src = UI('leads.src', 'all'), rep = UI('leads.rep', 'all'), fu = UI('leads.fu', 'any'), q = S.ui['leads.q'];
    const rows = D('leads').filter((l) => !l.customer && (st === 'all' || (l.status || 'new') === st) && (src === 'all' || l.source === src) && (rep === 'all' || (rep === 'none' ? !l.repId : l.repId === rep)) && fuFilter(fu, l.followUpAt) && match(q, l.name, l.phone, l.email, l.address))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const total = D('leads').filter((l) => !l.customer).length;
    const pg = pager('leads', rows.length);
    if (!rows.length) return `<div class="count"><b>0</b> of <b>${total}</b> leads</div><div class="panel">${emptyBox('clipboard', total ? 'No leads match your filters' : 'No leads yet', total ? 'Adjust filters or capture a new lead to start the pipeline.' : 'Capture your first inbound job: a call, a web form, a referral.', btn('Add lead', 'lead-new', { cls: 'btn-primary', icon: 'plus' }))}</div>${pg.html}`;
    return `<div class="count"><b>${rows.length}</b> of <b>${total}</b> leads</div><div class="panel tablewrap"><table class="t"><thead><tr><th>Client</th><th>Contact</th><th>Source</th><th>Status</th><th>Rep</th><th>Follow-up</th><th>Created</th></tr></thead><tbody>
      ${pg.slice(rows).map((l) => `<tr class="click" data-go="lead" data-param="${l.id}" tabindex="0"><td><div class="cell-main">${esc(l.name)}${exTag(l)}</div><div class="cell-sub">${esc([l.category, l.service].filter(Boolean).join(' · '))}</div></td><td><div>${esc(l.phone || '—')}</div><div class="cell-sub">${esc(l.email || '')}</div></td><td>${esc(l.source || '—')}</td><td>${badge(LEAD_STATUS, l.status || 'new')}</td><td>${esc(pname(l.repId) || '—')}</td><td class="small">${fuCell(l.followUpAt)}</td><td class="small muted">${fmtDate(l.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>${pg.html}`;
  }
};

/* ---------- Lead detail ---------- */
V.lead = {
  render() {
    const l = byId('leads', S.param);
    const back = `<button class="back" data-go="${l && l.customer ? 'customers' : 'leads'}">${icon('arrowL')}Back to ${l && l.customer ? 'customers' : 'leads'}</button>`;
    if (!l) return back + (ready('leads') ? `<div class="panel">${emptyBox('clipboard', 'Lead not found', 'It may have been deleted.')}</div>` : `<div class="panel">${loadingRows()}</div>`);
    const quotes = D('quotes').filter((q) => q.leadId === l.id);
    const invs = D('invoices').filter((i) => i.leadId === l.id);
    const projs = D('projects').filter((p) => p.leadId === l.id);
    const notes = [...(l.notes || [])].reverse();
    const hist = [...(l.history || [])].reverse();
    const maps = l.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}` : '';
    return back + `<div class="phead"><div style="min-width:0"><div class="eyebrow">${l.customer ? 'Customer' : 'Lead'} · ${esc(l.category || 'Residential')}</div><h1 class="title">${esc(l.name)}${exTag(l)}</h1><div class="row">${badge(LEAD_STATUS, l.status || 'new')}${l.customer ? '<span class="badge c-ok">Customer</span>' : ''}<span class="small muted">Added ${fmtDate(l.createdAt)}</span></div></div>
      <div class="acts"><select class="inp" style="width:170px" data-onchange="lead-status" data-id="${l.id}" aria-label="Lead status">${LEAD_STATUS.map(([v, t]) => `<option value="${v}" ${(l.status || 'new') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>${btn('Edit', 'lead-edit', { icon: 'edit', attrs: `data-id="${l.id}"` })}${btn('New quote', 'quote-from-lead', { cls: 'btn-primary', icon: 'briefcase', attrs: `data-id="${l.id}"` })}</div></div>
      <div class="split"><div class="stack">
        <div class="panel"><div class="panel-h"><h2 class="h2">Notes</h2><span class="xs muted">${notes.length} note${notes.length === 1 ? '' : 's'}</span></div><div class="pad stack">
          <div class="field"><label for="note-text">Add a note</label><textarea class="inp" id="note-text" rows="2" placeholder="Site visit details, measurements, budget, decision makers…"></textarea></div><div><button class="btn btn-sm" data-act="lead-note" data-id="${l.id}">${icon('plus')}Add note</button></div>
          ${notes.length ? `<div class="timeline">${notes.map((n) => `<div class="tl"><div><div class="xs muted">${fmtDT(n.at)}${n.by && S.names[n.by] ? ' · ' + esc(S.names[n.by]) : ''}</div><div style="white-space:pre-wrap">${esc(n.text)}</div></div></div>`).join('')}</div>` : ''}
        </div></div>
        <div class="panel"><div class="panel-h"><h2 class="h2">Quotes</h2>${btn('New quote', 'quote-from-lead', { cls: 'btn-sm', icon: 'plus', attrs: `data-id="${l.id}"` })}</div>
          ${quotes.length ? `<div class="list">${quotes.map((q) => `<div class="li click" data-go="quote" data-param="${q.id}" tabindex="0"><span class="mono small">${esc(q.ref)}</span><div class="grow trunc">${esc(quoteTitle(q))}</div>${badge(QUOTE_STATUS, quoteStatus(q))}<span class="num strong">${money0(quoteValue(q))}</span></div>`).join('')}</div>` : '<div class="mini-empty">No quotes yet for this lead.</div>'}</div>
        ${invs.length || projs.length ? `<div class="panel"><div class="panel-h"><h2 class="h2">Jobs & invoices</h2></div><div class="list">${projs.map((p) => `<div class="li click" data-go="project" data-param="${p.id}"><span class="badge c-grey">Project</span><div class="grow trunc">${esc(p.title)}</div>${badge(PROJECT_STATUS, p.status)}</div>`).join('')}${invs.map((i) => `<div class="li click" data-go="invoice" data-param="${i.id}"><span class="badge c-grey">Invoice</span><div class="grow trunc mono">${esc(i.number)}</div>${badge(INVOICE_STATUS, invStatus(i))}<span class="num strong">${money(i.total)}</span></div>`).join('')}</div></div>` : ''}
      </div>
      <div class="stack sticky">
        <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Contact</div><dl class="kv">
          <dt>Phone</dt><dd>${l.phone ? `<button class="linkbtn" data-act="copy" data-text="${esc(l.phone)}" title="Copy">${esc(l.phone)}</button>` : '—'}</dd>
          <dt>Email</dt><dd>${l.email ? `<button class="linkbtn" data-act="copy" data-text="${esc(l.email)}" title="Copy">${esc(l.email)}</button>` : '—'}</dd>
          <dt>Address</dt><dd>${l.address ? `<a href="${maps}" target="_blank" rel="noopener">${esc(l.address)}</a>` : '—'}</dd></dl></div>
        <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Details</div><dl class="kv">
          <dt>Service</dt><dd>${esc(l.service || '—')}</dd><dt>Source</dt><dd>${esc(l.source || '—')}</dd><dt>Rep</dt><dd>${esc(pname(l.repId) || 'Unassigned')}</dd>
          <dt>Follow-up</dt><dd>${l.followUpAt ? fmtDT(l.followUpAt) : '—'}</dd><dt>Updated</dt><dd>${ago(l.updatedAt)}</dd></dl>
          <div class="row" style="margin-top:14px">${btn('Log call', 'fu-answer', { cls: 'btn-sm', icon: 'phone', attrs: `data-kind="leads" data-id="${l.id}"` })}${btn('Delete', 'lead-del', { cls: 'btn-sm btn-danger', icon: 'trash', attrs: `data-id="${l.id}"` })}</div></div>
        ${hist.length ? `<div class="panel pad"><div class="eyebrow" style="margin-bottom:8px">Follow-up history</div><div class="timeline">${hist.slice(0, 12).map((h) => `<div class="tl"><div><div class="xs muted">${fmtDT(h.at)}</div><div class="small"><b>${esc(OUTCOME[h.outcome] || h.outcome)}</b>${h.note ? ' · ' + esc(h.note) : ''}</div></div></div>`).join('')}</div></div>` : ''}
      </div></div>`;
  }
};

/* ============ Customers ============ */
V.customers = {
  render() {
    return pageHead({ eyebrow: 'Pipeline · Customers', title: 'Customers', lede: 'Everyone who has approved a quote. Click a row to drill in.', acts: btn('Export CSV', 'cust-csv', { icon: 'download' }) })
      + `<div class="panel filters"><div class="frow">${searchBox('cust.q', 'Search name, phone, email, address')}<select class="inp" style="width:200px" data-fsel="cust.rep" aria-label="Rep">${[['all', 'All reps'], ...repList().map((r) => [r.id, r.name])].map(([v, l]) => `<option value="${v}" ${UI('cust.rep', 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div><div class="lbl">Source</div>${chips('cust.src', [['all', 'All'], ...S.cfg.sources.map((s) => [s, s])], UI('cust.src', 'all'))}</div></div><div id="results">${this.results()}</div>`;
  },
  rows() {
    const src = UI('cust.src', 'all'), rep = UI('cust.rep', 'all'), q = S.ui['cust.q'];
    return D('leads').filter((l) => l.customer && (src === 'all' || l.source === src) && (rep === 'all' || l.repId === rep) && match(q, l.name, l.phone, l.email, l.address))
      .map((l) => { const inv = D('invoices').filter((i) => i.leadId === l.id && !i.void); return { l, ltv: sum(inv, (i) => i.total), due: sum(inv, invDue), jobs: D('projects').filter((p) => p.leadId === l.id).length }; })
      .sort((a, b) => b.ltv - a.ltv);
  },
  results() {
    if (!ready('leads', 'invoices')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const rows = this.rows(); const total = D('leads').filter((l) => l.customer).length;
    if (!rows.length) return `<div class="count"><b>0</b> of <b>${total}</b> customers</div><div class="panel">${emptyBox('users', total ? 'No customers match your filters' : 'No customers yet', 'Leads move here once they approve a quote.')}</div>`;
    return `<div class="count"><b>${rows.length}</b> of <b>${total}</b> customers</div><div class="panel tablewrap"><table class="t"><thead><tr><th>Customer</th><th>Contact</th><th>Address</th><th>Source</th><th>Rep</th><th class="r">Jobs</th><th class="r">Lifetime value</th><th class="r">Balance due</th></tr></thead><tbody>
      ${rows.map(({ l, ltv, due, jobs }) => `<tr class="click" data-go="lead" data-param="${l.id}" tabindex="0"><td class="cell-main">${esc(l.name)}${exTag(l)}</td><td><div>${esc(l.phone || '—')}</div><div class="cell-sub">${esc(l.email || '')}</div></td><td class="small">${esc(l.address || '—')}</td><td>${esc(l.source || '—')}</td><td>${esc(pname(l.repId) || '—')}</td><td class="r num">${jobs}</td><td class="r num strong">${money0(ltv)}</td><td class="r num" style="${due > 0 ? 'color:var(--danger);font-weight:700' : ''}">${money(due)}</td></tr>`).join('')}</tbody></table></div>`;
  }
};
ACT['cust-csv'] = () => saveFile(`customers-${todayKey()}.csv`, csv([['Name', 'Phone', 'Email', 'Address', 'Source', 'Rep', 'Jobs', 'Lifetime value', 'Balance due'], ...V.customers.rows().map(({ l, ltv, due, jobs }) => [l.name, l.phone, l.email, l.address, l.source, pname(l.repId), jobs, ltv.toFixed(2), due.toFixed(2)])]));

/* ============ Follow-ups ============ */
const OUTCOME = { answered: 'Answered', no_answer: 'No answer', voicemail: 'Voicemail', snooze: 'Snoozed', note: 'Note' };
async function logOutcome(kind, id, outcome, patch = {}, note = '') {
  const rec = byId(kind, id); if (!rec) return;
  const history = [...(rec.history || []), { at: nowISO(), outcome, note, by: S.me.id }];
  await Store.update(kind, id, { history, ...patch });
}
ACT['fu-no'] = async (el) => { const { kind, id } = el.dataset; const rec = byId(kind, id); const patch = { followUpAt: localDT(addDays(new Date(), 1)), snoozed: false }; if (kind === 'leads' && (rec.status || 'new') === 'new') patch.status = 'contacted'; if (kind === 'quotes' && quoteStatus(rec) === 'pending') patch.status = 'follow_up'; await logOutcome(kind, id, 'no_answer', patch); toast('Logged: no answer. Back in the queue tomorrow.'); };
ACT['fu-vm'] = async (el) => { const { kind, id } = el.dataset; const rec = byId(kind, id); const patch = { followUpAt: localDT(addDays(new Date(), 2)), snoozed: false }; if (kind === 'leads' && (rec.status || 'new') === 'new') patch.status = 'contacted'; if (kind === 'quotes' && quoteStatus(rec) === 'pending') patch.status = 'follow_up'; await logOutcome(kind, id, 'voicemail', patch); toast('Logged: voicemail. Follow up again in 2 days.'); };
ACT['fu-snooze'] = async (el) => { const { kind, id, days } = el.dataset; const d = addDays(new Date(), num(days)); d.setHours(9, 0, 0, 0); await logOutcome(kind, id, 'snooze', { followUpAt: localDT(d), snoozed: true }, `until ${fmtDate(dkey(d))}`); toast(`Snoozed until ${fmtDate(dkey(d))}`); };
ACT['fu-answer'] = (el) => {
  const { kind, id } = el.dataset; const rec = byId(kind, id);
  const next = localDT((() => { const d = addDays(new Date(), num(S.cfg.followUpDays) || 3); d.setHours(10, 0, 0, 0); return d; })());
  const statusSel = kind === 'quotes' ? F.select('status', 'Quote status', [['', 'No change'], ['follow_up', 'Still deciding (follow-up)'], ['lost', 'Lost']], '') : kind === 'leads' ? F.select('status', 'Lead status', [['', 'No change'], ...LEAD_STATUS.map((s) => [s[0], s[1]])], '') : '';
  openModal({
    title: 'Log a conversation', body: `<p class="small muted" style="margin:0">${esc(rec.name || (rec.client && rec.client.name) || rec.number || '')}</p><div class="grid2">${F.area('note', 'What was said', '', { rows: 3, ph: 'They want to compare two options, will decide after Friday…' })}${statusSel}${F.text('next', 'Next follow-up', next, { type: 'datetime-local', hint: 'Clear it to take them out of the queue.' })}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="fu-save">Save</button>`,
    onMount: (m) => { $('#fu-save', m).onclick = async () => { const f = formData(m); const patch = { followUpAt: f.next || null, snoozed: false }; if (f.status) patch.status = f.status; if (kind === 'leads' && !f.status && (rec.status || 'new') === 'new') patch.status = 'contacted'; await logOutcome(kind, id, 'answered', patch, f.note); closeModal(); toast('Conversation logged'); }; }
  });
};
V.followups = {
  render() {
    const kind = UI('fu.kind', 'leads');
    const items = followItems();
    const ct = (k) => items.filter((x) => x.kind === k && x.bucket !== 'later' && x.bucket !== 'snoozed').length;
    return pageHead({ eyebrow: 'Pipeline · Follow-ups', title: "Today's queue", lede: 'Work through the queue: <b>Answered</b>, <b>No answer</b>, or <b>Voicemail</b>. Each tap logs the call and schedules the next one.' })
      + `<div class="row" style="margin-bottom:14px"><div class="seg">${[['leads', 'Leads', 'clipboard'], ['quotes', 'Quotes', 'briefcase'], ['invoices', 'Invoices', 'receipt']].map(([k, l, i]) => `<button class="${kind === k ? 'on' : ''}" data-act="ui" data-k="fu.kind" data-v="${k}">${icon(i)}${l} <span class="mono">${ct(k)}</span></button>`).join('')}</div>
        <select class="inp inp-sm" style="width:180px" data-fsel="fu.rep" aria-label="Rep">${[['all', 'All reps'], ...repList().map((r) => [r.id, r.name])].map(([v, l]) => `<option value="${v}" ${UI('fu.rep', 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div style="margin-bottom:14px">${searchBox('fu.q', 'Search by client name, phone, email, or address…')}</div><div id="results">${this.results()}</div>`;
  },
  results() {
    if (!ready('leads', 'quotes', 'invoices')) return `<div class="panel">${loadingRows()}</div>`;
    const kind = UI('fu.kind', 'leads'), b = UI('fu.bucket', 'overdue'), rep = UI('fu.rep', 'all'), q = S.ui['fu.q'];
    const all = followItems().filter((x) => x.kind === kind && (rep === 'all' || x.repId === rep) && match(q, x.name, x.phone, x.email, x.address));
    const tabs = [['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['snoozed', 'Snoozed']];
    const rows = all.filter((x) => x.bucket === b);
    const label = kind.slice(0, -1);
    return `<div class="tabs">${tabs.map(([k, l]) => `<button class="${b === k ? 'on' : ''}" data-act="ui" data-k="fu.bucket" data-v="${k}">${l} <span class="badge c-grey">${all.filter((x) => x.bucket === k).length}</span></button>`).join('')}</div>
      ${rows.length ? `<div class="panel list">${rows.map((x) => `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:200px"><button class="linkbtn strong" style="color:var(--fg)" data-go="${label}" data-param="${x.id}">${esc(x.name)}</button>${exTag(x.rec)}<div class="xs muted trunc">${esc(x.sub)}</div><div class="xs">${x.phone ? `<button class="linkbtn" data-act="copy" data-text="${esc(x.phone)}">${icon('phone')} ${esc(x.phone)}</button>` : '<span class="muted">No phone</span>'} <span class="muted">· due ${fmtDT(x.due)}${x.repId ? ' · ' + esc(pname(x.repId)) : ''}</span></div></div>
        <div class="row" style="gap:6px">${btn('Answered', 'fu-answer', { cls: 'btn-xs', icon: 'check', attrs: `data-kind="${kind}" data-id="${x.id}"` })}${btn('No answer', 'fu-no', { cls: 'btn-xs', attrs: `data-kind="${kind}" data-id="${x.id}"` })}${btn('Voicemail', 'fu-vm', { cls: 'btn-xs', attrs: `data-kind="${kind}" data-id="${x.id}"` })}${btn('+3d', 'fu-snooze', { cls: 'btn-xs btn-ghost', attrs: `data-kind="${kind}" data-id="${x.id}" data-days="3" title="Snooze 3 days"` })}${btn('+1w', 'fu-snooze', { cls: 'btn-xs btn-ghost', attrs: `data-kind="${kind}" data-id="${x.id}" data-days="7" title="Snooze 1 week"` })}</div></div>`).join('')}</div>`
        : `<div class="panel">${emptyBox('check', 'All clear', b === 'overdue' ? `No overdue ${kind}. Crew's caught up.` : `Nothing in this bucket.`, btn('Go to ' + kind, null, { go: kind, icon: 'arrowR' }))}</div>`}`;
  }
};

/* ============ My Today ============ */
V.today = {
  render() {
    const m = myMember();
    const crewOnly = (S.role === 'CREW' || S.role === 'CREW_LEAD') && m;
    const jobs = D('projects').filter((p) => activeToday(p) && (!crewOnly || (p.crew || []).includes(m.id)));
    const starting = D('projects').filter((p) => p.start > todayKey() && p.start <= keyPlus(7) && !['cancelled', 'completed'].includes(p.status) && (!crewOnly || (p.crew || []).includes(m.id))).sort((a, b) => a.start.localeCompare(b.start));
    const fu = followItems().filter((x) => (x.bucket === 'overdue' || x.bucket === 'today') && (!m || S.role === 'OWNER' || x.repId === m.id));
    const head = `<div class="phead"><div><div class="eyebrow">My day</div><h1 class="title">Today</h1><div class="small muted">${fmtDate(todayKey(), { weekday: 'long', month: 'long', day: 'numeric' })}${S.me.name ? ' · ' + esc(S.me.name) : ''}${m ? ' · ' + esc(ROLES[m.role] || '') : ''}</div></div><div class="acts">${btn('Calendar', null, { go: 'calendar', icon: 'calendar' })}</div></div>`;
    const jobsP = `<div class="panel"><div class="panel-h"><h2 class="h2">Jobs on site today</h2><span class="xs muted">${jobs.length}</span></div>${jobs.length ? `<div class="list">${jobs.map((p) => `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:200px"><button class="linkbtn strong" style="color:var(--fg)" data-go="project" data-param="${p.id}">${esc(p.title)}</button>${exTag(p)}<div class="xs muted">${p.siteAddress ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.siteAddress)}" target="_blank" rel="noopener">${icon('pin')} ${esc(p.siteAddress)}</a>` : ''}</div><div class="xs muted">Crew: ${esc((p.crew || []).map(pname).filter(Boolean).join(', ') || 'unassigned')}</div></div>${badge(PROJECT_STATUS, p.status)}${btn('Log hours', 'labor-add', { cls: 'btn-sm btn-primary', icon: 'clock', attrs: `data-id="${p.id}"` })}</div>`).join('')}</div>` : emptyBox('home', 'No jobs today.', "You're clear. New bookings show up here automatically.", btn('Open calendar', null, { go: 'calendar', icon: 'calendar' }))}</div>`;
    const startP = `<div class="panel"><div class="panel-h"><h2 class="h2">Starting this week</h2></div>${starting.length ? `<div class="list">${starting.map((p) => `<div class="li click" data-go="project" data-param="${p.id}"><span class="mono small">${fmtShort(p.start)}</span><div class="grow trunc">${esc(p.title)}</div>${badge(PROJECT_STATUS, p.status)}</div>`).join('')}</div>` : '<div class="mini-empty">Nothing starting in the next 7 days.</div>'}</div>`;
    const fuP = S.role === 'CREW' || S.role === 'CREW_LEAD' ? '' : `<div class="panel"><div class="panel-h"><h2 class="h2">Calls to make</h2><button class="btn btn-sm" data-go="followups">Open queue</button></div>${fu.length ? `<div class="list">${fu.slice(0, 8).map((x) => `<div class="li click" data-go="${x.kind.slice(0, -1)}" data-param="${x.id}"><span class="badge ${x.bucket === 'overdue' ? 'c-bad' : 'c-warn'}">${x.bucket}</span><div class="grow trunc">${esc(x.name)}</div><span class="xs muted">${esc(x.phone || '')}</span></div>`).join('')}</div>` : '<div class="mini-empty">No calls due today.</div>'}</div>`;
    return head + `<div class="stack" style="max-width:860px">${jobsP}${fuP}${startP}</div>`;
  }
};
