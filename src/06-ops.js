/* ============ Projects ============ */
function projectModal(p) {
  p = p || {};
  openModal({
    title: p.id ? 'Edit project' : 'Create project',
    body: `<div class="grid2">${F.text('title', 'Title', p.title, { req: true, span: true, hint: 'Custom label for this project; shows in lists and on the calendar.' })}
      ${F.text('cname', 'Client name', p.client && p.client.name, { req: true })}${F.text('cphone', 'Client phone', p.client && p.client.phone, { type: 'tel' })}
      ${F.text('cemail', 'Client email', p.client && p.client.email, { type: 'email' })}${F.text('siteAddress', 'Site address', p.siteAddress)}
      ${F.text('start', 'Scheduled start', p.start, { type: 'date' })}${F.text('end', 'Scheduled end', p.end, { type: 'date' })}
      ${F.text('revenue', 'Contract value (pre-tax)', p.revenue || '', { type: 'number', step: '0.01', hint: p.invoiceId ? 'Taken from the linked invoice.' : 'Used for margin when there is no invoice.' })}
      ${F.select('status', 'Status', PROJECT_STATUS.map((s) => [s[0], s[1]]), p.status || (p.start ? 'scheduled' : 'pending'))}
      ${F.area('description', 'Description', p.description, { rows: 3 })}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="pj-ok">${icon('check')}${p.id ? 'Save' : 'Create'}</button>`,
    onMount: (m) => { $('#pj-ok', m).onclick = async () => { const f = formData(m); if (!f.title || !f.cname) { toast('Title and client name are required.', 'bad'); return; } if (f.end && f.start && f.end < f.start) { toast('End date is before the start date.', 'bad'); return; } const body = { title: f.title, client: { ...(p.client || {}), name: f.cname, phone: f.cphone, email: f.cemail }, siteAddress: f.siteAddress, start: f.start, end: f.end || f.start, revenue: num(f.revenue), status: f.status, description: f.description }; if (p.id) { await Store.update('projects', p.id, body); await syncQuote(p, f.status); toast('Project saved'); closeModal(); } else { const id = await Store.add('projects', { ...body, crew: [], labor: [], notes: '' }); closeModal(); toast('Project created'); go('project', id); } }; }
  });
}
async function syncQuote(p, status) {
  const q = byId('quotes', p.quoteId); if (!q || q.status === 'paid') return;
  const map = { scheduled: 'scheduled', in_progress: 'in_progress' };
  if (map[status] && q.status !== map[status]) await Store.update('quotes', q.id, { status: map[status] });
}
ACT['pj-new'] = () => projectModal();
ACT['pj-edit'] = () => projectModal(byId('projects', S.param));
ACT['pj-status'] = async (el) => { const p = byId('projects', el.dataset.id || S.param); const patch = { status: el.value }; if (el.value === 'completed') patch.completedAt = todayKey(); await Store.update('projects', p.id, patch); await syncQuote(p, el.value); toast('Status updated'); };
ACT['pj-date'] = async (el) => { const p = byId('projects', S.param); const patch = { [el.dataset.field]: el.value }; if (el.dataset.field === 'start' && (!p.end || p.end < el.value)) patch.end = el.value; if (el.dataset.field === 'start' && el.value && p.status === 'pending') { patch.status = 'scheduled'; await syncQuote(p, 'scheduled'); } await Store.update('projects', p.id, patch); toast('Schedule updated'); };
ACT['pj-crew'] = async (el) => { const p = byId('projects', S.param); const id = el.dataset.id; const crew = (p.crew || []).includes(id) ? p.crew.filter((x) => x !== id) : [...(p.crew || []), id]; await Store.update('projects', p.id, { crew }); };
ACT['pj-notes'] = async (el) => { await Store.update('projects', S.param, { notes: el.value }); toast('Notes saved'); };
ACT['pj-del'] = () => confirmBox('Delete this project?', 'Labour logged on it is removed too. The invoice and quote stay.', 'Delete project', async () => { await Store.del('projects', S.param); toast('Project deleted'); go('projects'); });
ACT['labor-add'] = (el) => {
  const p = byId('projects', el.dataset.id || S.param); const me = myMember();
  const crew = crewList(); if (!crew.length) { toast('Add crew members in Team first.', 'bad'); return; }
  const def = me && me.type === 'crew' ? me : crew[0];
  openModal({ title: 'Log hours', body: `<p class="small muted" style="margin:0">${esc(p.title)}</p><div class="grid2">${F.select('memberId', 'Crew member', crew.map((c) => [c.id, c.name]), def.id)}${F.text('date', 'Date', todayKey(), { type: 'date' })}${F.text('hours', 'Hours', '8', { type: 'number', step: '0.25', min: 0 })}${F.text('rate', 'Hourly rate', def.hourlyRate || '', { type: 'number', step: '0.01', hint: 'Defaults to the member\'s rate.' })}${F.text('note', 'Note', '', { ph: 'Posts set, rails on north side…', span: true })}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="lb-ok">Log hours</button>`,
    onMount: (m) => { $('#f-memberId', m).onchange = (e) => { const c = byId('team', e.target.value); $('#f-rate', m).value = (c && c.hourlyRate) || ''; }; $('#lb-ok', m).onclick = async () => { const f = formData(m); if (!(num(f.hours) > 0)) { toast('Enter hours worked.', 'bad'); return; } const cur = byId('projects', p.id); const patch = { labor: [...(cur.labor || []), { id: uid(), memberId: f.memberId, date: f.date, hours: num(f.hours), rate: num(f.rate), note: f.note, by: S.me.id }] }; if (!(cur.crew || []).includes(f.memberId)) patch.crew = [...(cur.crew || []), f.memberId]; if (cur.status === 'scheduled' || cur.status === 'pending') { patch.status = 'in_progress'; await syncQuote(cur, 'in_progress'); } await Store.update('projects', p.id, patch); closeModal(); toast(`${f.hours}h logged`); }; } });
};
ACT['labor-del'] = (el) => confirmBox('Remove this time entry?', 'Payroll and job cost update right away.', 'Remove', async () => { const p = byId('projects', S.param); await Store.update('projects', p.id, { labor: (p.labor || []).filter((l) => l.id !== el.dataset.lid) }); toast('Entry removed'); });

V.projects = {
  render() {
    const view = UI('pj.view', 'list');
    return pageHead({ eyebrow: 'Job sites', title: 'Projects', lede: 'Schedule crews, track progress, and log labour hours.', acts: `<div class="seg"><button class="${view === 'list' ? 'on' : ''}" data-act="ui" data-k="pj.view" data-v="list">${icon('list')}List</button><button class="${view === 'kanban' ? 'on' : ''}" data-act="ui" data-k="pj.view" data-v="kanban">${icon('kanban')}Kanban</button></div>${btn('New project', 'pj-new', { cls: 'btn-primary', icon: 'plus' })}` })
      + `<div class="panel filters"><div class="frow">${searchBox('pj.q', 'Search address, client, title…')}</div><div><div class="lbl">Status</div>${chips('pj.status', [['all', 'All'], ...PROJECT_STATUS.map(([v, l]) => [v, l, D('projects').filter((p) => p.status === v).length || null])], UI('pj.status', 'all'))}</div></div><div id="results">${this.results()}</div>`;
  },
  results() {
    if (!ready('projects')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const st = UI('pj.status', 'all'), q = S.ui['pj.q'], view = UI('pj.view', 'list');
    const rows = D('projects').filter((p) => (st === 'all' || p.status === st || view === 'kanban') && match(q, p.title, p.client && p.client.name, p.siteAddress)).sort((a, b) => String(a.start || '9').localeCompare(String(b.start || '9')));
    if (!rows.length) return `<div class="panel" style="margin-top:20px">${emptyBox('hardhat', D('projects').length ? 'No projects match' : 'No projects yet', 'Projects appear automatically when you convert a quote to an invoice, or start one here.', btn('New project', 'pj-new', { cls: 'btn-primary', icon: 'plus' }))}</div>`;
    if (view === 'kanban') return `<div class="kanban" style="margin-top:20px">${PROJECT_STATUS.map(([s, l, c]) => { const col = rows.filter((p) => p.status === s); return `<div class="kcol"><h4><span class="badge ${c}">${l}</span><span class="mono">${col.length}</span></h4><div class="kcards">${col.map((p) => { const f = projectFin(p); return `<div class="kcard" data-go="project" data-param="${p.id}" tabindex="0"><div class="strong small">${esc(p.title)}${exTag(p)}</div><div class="xs muted">${esc((p.client && p.client.name) || '')}</div><div class="xs muted">${p.start ? fmtShort(p.start) + (p.end && p.end !== p.start ? ' – ' + fmtShort(p.end) : '') : 'Not scheduled'}</div>${f.revenue ? `<div class="xs"><span class="num">${money0(f.revenue)}</span>${f.margin != null && f.cost ? ` · <span class="num" style="color:${f.margin < 0.2 ? 'var(--danger)' : 'var(--ok)'}">${pct(f.margin)}</span>` : ''}</div>` : ''}</div>`; }).join('') || '<div class="xs muted" style="padding:6px">—</div>'}</div></div>`; }).join('')}</div>`;
    return `<div class="count"><b>${rows.length}</b> projects</div><div class="panel tablewrap"><table class="t"><thead><tr><th>Project</th><th>Status</th><th>Schedule</th><th>Crew</th><th class="r">Hours</th><th class="r">Revenue</th><th class="r">Margin</th></tr></thead><tbody>${rows.map((p) => { const f = projectFin(p); return `<tr class="click" data-go="project" data-param="${p.id}" tabindex="0"><td><div class="cell-main">${esc(p.title)}${exTag(p)}</div><div class="cell-sub">${esc([(p.client && p.client.name), p.siteAddress].filter(Boolean).join(' · '))}</div></td><td>${badge(PROJECT_STATUS, p.status)}</td><td class="small">${p.start ? fmtShort(p.start) + (p.end && p.end !== p.start ? ' – ' + fmtShort(p.end) : '') : '<span class="muted">Not scheduled</span>'}</td><td class="small">${esc((p.crew || []).map(pname).filter(Boolean).join(', ') || '—')}</td><td class="r num">${f.hours ? f.hours.toFixed(1) : '—'}</td><td class="r num">${f.revenue ? money0(f.revenue) : '—'}</td><td class="r num strong" style="color:${f.margin == null || !f.cost ? 'inherit' : f.margin < 0.2 ? 'var(--danger)' : 'var(--ok)'}">${f.cost && f.revenue ? pct(f.margin) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
};

V.project = {
  render() {
    const back = `<button class="back" data-go="projects">${icon('arrowL')}Back to projects</button>`;
    const p = byId('projects', S.param);
    if (!p) return back + `<div class="panel">${ready('projects') ? emptyBox('hardhat', 'Project not found', 'It may have been deleted.') : loadingRows()}</div>`;
    const f = projectFin(p);
    const ex = D('expenses').filter((e) => e.projectId === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const labor = [...(p.labor || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const crew = crewList();
    const pl = (l, v, c) => `<dt>${l}</dt><dd class="num" ${c ? `style="color:${c}"` : ''}>${/^−?\$?0\.00$/.test(v.replace(S.cfg.currency, '$').replace('$', '')) || v === '−' + money(0) ? '—' : v}</dd>`;
    return back + `<div class="phead"><div style="min-width:0"><div class="eyebrow">Project · ${esc((p.client && p.client.name) || '')}</div><h1 class="title" style="font-size:34px">${esc(p.title)}${exTag(p)}</h1><div class="row">${badge(PROJECT_STATUS, p.status)}${p.siteAddress ? `<a class="small" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.siteAddress)}" target="_blank" rel="noopener">${icon('pin')} ${esc(p.siteAddress)}</a>` : ''}</div></div>
      <div class="acts"><select class="inp" style="width:170px" data-onchange="pj-status" data-id="${p.id}" aria-label="Project status">${PROJECT_STATUS.map(([v, l]) => `<option value="${v}" ${p.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${btn('Edit', 'pj-edit', { icon: 'edit' })}${btn('Log hours', 'labor-add', { cls: 'btn-primary', icon: 'clock', attrs: `data-id="${p.id}"` })}</div></div>
      <div class="split"><div class="stack">
        <div class="panel"><div class="panel-h"><h2 class="h2">Schedule & crew</h2></div><div class="pad stack"><div class="grid2"><div class="field"><label for="pj-start">Start</label><input class="inp" type="date" id="pj-start" value="${esc(p.start || '')}" data-onchange="pj-date" data-field="start"></div><div class="field"><label for="pj-end">End</label><input class="inp" type="date" id="pj-end" value="${esc(p.end || '')}" data-onchange="pj-date" data-field="end"></div></div>
          <div><div class="lbl">Assigned crew</div>${crew.length ? `<div class="chips">${crew.map((c) => `<button class="chip ${(p.crew || []).includes(c.id) ? 'on' : ''}" data-act="pj-crew" data-id="${c.id}">${(p.crew || []).includes(c.id) ? icon('check') : ''}${esc(c.name)}</button>`).join('')}</div>` : `<p class="small muted">No crew yet. <button class="linkbtn" data-go="team">Add crew in Team</button></p>`}</div></div></div>
        <div class="panel"><div class="panel-h"><div><h2 class="h2">Labour log</h2><div class="sub">${f.hours.toFixed(1)} hours · ${money(sum(labor, (l) => num(l.hours) * num(l.rate)))}</div></div>${btn('Log hours', 'labor-add', { cls: 'btn-sm', icon: 'plus', attrs: `data-id="${p.id}"` })}</div>${labor.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Crew</th><th class="r">Hours</th><th class="r">Rate</th><th class="r">Cost</th><th>Note</th><th></th></tr></thead><tbody>${labor.map((l) => `<tr><td class="small nw">${fmtDate(l.date)}</td><td>${esc(pname(l.memberId) || '—')}</td><td class="r num">${num(l.hours).toFixed(2)}</td><td class="r num">${money(l.rate)}</td><td class="r num">${money(num(l.hours) * num(l.rate))}</td><td class="small muted">${esc(l.note || '')}</td><td><button class="iconbtn" data-act="labor-del" data-lid="${l.id}" aria-label="Remove entry">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="mini-empty">No hours logged yet.</div>'}</div>
        <div class="panel"><div class="panel-h"><div><h2 class="h2">Expenses</h2><div class="sub">Materials, dump, rentals, subs: every cost that isn't crew labour</div></div>${btn('Add expense', 'exp-new', { cls: 'btn-sm', icon: 'plus', attrs: `data-project="${p.id}"` })}</div>${ex.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th class="r">Amount</th></tr></thead><tbody>${ex.map((e) => `<tr class="click" data-act="exp-edit" data-id="${e.id}"><td class="small nw">${fmtDate(e.date)}</td><td><span class="badge c-grey">${esc(e.category)}</span></td><td>${esc(e.description || '')}</td><td>${esc(e.vendor || (e.subId ? pname(e.subId) : '') || '—')}</td><td class="r num">${money(e.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mini-empty">No expenses recorded for this project.</div>'}</div>
        <div class="panel"><div class="panel-h"><h2 class="h2">Notes</h2><span class="xs muted">Saved when you click away</span></div><div class="pad"><textarea class="inp" rows="4" data-onchange="pj-notes" aria-label="Project notes" placeholder="Gate codes, utility locates, material orders…">${esc(p.notes || '')}</textarea>${p.description ? `<p class="small muted" style="white-space:pre-wrap;margin:12px 0 0">${esc(p.description)}</p>` : ''}</div></div>
      </div>
      <div class="stack sticky">
        <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Job cost</div><dl class="kv">${pl('Revenue (pre-tax)', money(f.revenue))}${pl('Crew labour', '−' + money(f.labor))}${pl('Materials & other', '−' + money(f.materials))}${pl('Subcontractors', '−' + money(f.subs))}${pl('Rep commission', '−' + money(f.commission))}</dl>
          <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px" class="row between"><span class="strong">Gross profit</span><span class="num" style="font-family:var(--font-display);font-weight:900;font-size:22px;color:${f.profit < 0 ? 'var(--danger)' : 'var(--fg)'}">${money(f.profit)}</span></div>
          <div class="row between"><span class="small muted">Margin</span><span class="badge ${f.margin == null ? 'c-grey' : f.margin < 0.2 ? 'c-bad' : f.margin < 0.35 ? 'c-warn' : 'c-ok'}">${f.revenue ? pct(f.margin, 1) : 'No revenue'}</span></div></div>
        <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Client</div><dl class="kv"><dt>Name</dt><dd>${esc((p.client && p.client.name) || '—')}</dd><dt>Phone</dt><dd>${p.client && p.client.phone ? `<button class="linkbtn" data-act="copy" data-text="${esc(p.client.phone)}">${esc(p.client.phone)}</button>` : '—'}</dd><dt>Email</dt><dd>${esc((p.client && p.client.email) || '—')}</dd></dl></div>
        <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Linked records</div><dl class="kv"><dt>Invoice</dt><dd>${f.inv ? `<button class="linkbtn" data-go="invoice" data-param="${f.inv.id}">${esc(f.inv.number)} · ${statusMeta(INVOICE_STATUS, invStatus(f.inv))[1]}</button>` : '—'}</dd><dt>Quote</dt><dd>${p.quoteId && byId('quotes', p.quoteId) ? `<button class="linkbtn" data-go="quote" data-param="${p.quoteId}">${esc(byId('quotes', p.quoteId).ref)}</button>` : '—'}</dd><dt>Lead</dt><dd>${p.leadId ? `<button class="linkbtn" data-go="lead" data-param="${p.leadId}">Open →</button>` : '—'}</dd></dl><div style="margin-top:14px">${btn('Delete project', 'pj-del', { cls: 'btn-sm btn-danger', icon: 'trash' })}</div></div>
      </div></div>`;
  }
};

/* ============ Schedule calendar ============ */
const STATUS_COLOR = { pending: 'var(--muted-fg)', scheduled: 'var(--info)', in_progress: 'var(--primary)', on_hold: 'var(--warn)', completed: 'var(--ok)', cancelled: 'var(--danger)' };
V.calendar = {
  render() {
    const mode = UI('cal.mode', 'month');
    const anchor = parseKey(UI('cal.anchor', todayKey()));
    const hidden = UI('cal.hide', () => ({ cancelled: true }));
    const who = UI('cal.who', 'all');
    const evs = D('projects').filter((p) => p.start && !hidden[p.status] && (who === 'all' || (p.crew || []).includes(who)));
    let from, to, title;
    if (mode === 'month') { const f = new Date(anchor.getFullYear(), anchor.getMonth(), 1); from = addDays(f, -((f.getDay() + 6) % 7)); to = addDays(from, 41); title = anchor.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); }
    else { from = addDays(anchor, -((anchor.getDay() + 6) % 7)); to = addDays(from, 6); title = `${fmtShort(dkey(from))} – ${fmtDate(dkey(to))}`; }
    const days = []; for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(dkey(d));
    const on = (k) => evs.filter((p) => p.start <= k && (p.end || p.start) >= k);
    const count = evs.filter((p) => p.start <= dkey(to) && (p.end || p.start) >= dkey(from)).length;
    const head = `<div class="phead"><div><div class="eyebrow">Operations</div><h1 class="title">Schedule Calendar</h1><p class="lede">Scheduled projects across every crew. Set dates on a project to place it here.</p></div><div class="acts"><div class="seg"><button class="${mode === 'month' ? 'on' : ''}" data-act="ui" data-k="cal.mode" data-v="month">Month</button><button class="${mode === 'week' ? 'on' : ''}" data-act="ui" data-k="cal.mode" data-v="week">Week</button></div></div></div>
      <div class="panel filters" style="gap:12px"><div class="row"><span class="lbl">Status</span><div class="legend">${PROJECT_STATUS.map(([s, l]) => `<button class="chip ${hidden[s] ? '' : 'on'}" style="${hidden[s] ? '' : `border-color:${STATUS_COLOR[s]};color:${STATUS_COLOR[s]}`}" data-act="cal-hide" data-s="${s}">${esc(l)}</button>`).join('')}</div></div>
      <div class="row"><span class="lbl">Assignee</span><select class="inp inp-sm" style="width:200px" data-fsel="cal.who" aria-label="Assignee">${[['all', 'All crew'], ...crewList().map((c) => [c.id, c.name])].map(([v, l]) => `<option value="${v}" ${who === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>
      <div class="row between" style="margin:16px 0 12px"><div class="row"><button class="iconbtn" data-act="cal-move" data-d="-1" aria-label="Previous">${icon('chevL')}</button><button class="btn btn-sm" data-act="ui" data-k="cal.anchor" data-v="${todayKey()}">Today</button><button class="iconbtn" data-act="cal-move" data-d="1" aria-label="Next">${icon('chevR')}</button></div><h2 class="h2">${esc(title)}</h2><span class="xs muted">${count} event${count === 1 ? '' : 's'}</span></div>`;
    if (!ready('projects')) return head + `<div class="panel">${loadingRows()}</div>`;
    const t = todayKey();
    if (mode === 'month') {
      return head + `<div class="tablewrap"><div class="cal" style="min-width:720px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}${days.map((k) => { const list = on(k); const out = parseKey(k).getMonth() !== anchor.getMonth(); return `<div class="day ${out ? 'out' : ''} ${k === t ? 'today' : ''}"><span class="dn">${parseKey(k).getDate()}</span>${list.slice(0, 4).map((p) => `<div class="ev" style="--c:${STATUS_COLOR[p.status] || 'var(--info)'}" data-go="project" data-param="${p.id}" title="${esc(p.title)}">${esc(p.title)}</div>`).join('')}${list.length > 4 ? `<span class="xs muted">+${list.length - 4} more</span>` : ''}</div>`; }).join('')}</div></div>`;
    }
    return head + `<div class="stack">${days.map((k) => { const list = on(k); return `<div class="panel"><div class="panel-h" style="padding:10px 16px"><span class="strong ${k === t ? '' : ''}" style="${k === t ? 'color:var(--today)' : ''}">${fmtDate(k, { weekday: 'long', month: 'short', day: 'numeric' })}</span><span class="xs muted">${list.length} job${list.length === 1 ? '' : 's'}</span></div>${list.length ? `<div class="list">${list.map((p) => `<div class="li click" data-go="project" data-param="${p.id}"><span class="ev" style="--c:${STATUS_COLOR[p.status]};width:6px;padding:0;height:28px"></span><div class="grow"><div class="strong trunc">${esc(p.title)}</div><div class="xs muted trunc">${esc(p.siteAddress || '')} · ${esc((p.crew || []).map(pname).filter(Boolean).join(', ') || 'No crew')}</div></div>${badge(PROJECT_STATUS, p.status)}</div>`).join('')}</div>` : ''}</div>`; }).join('')}</div>`;
  }
};
ACT['cal-hide'] = (el) => { const h = UI('cal.hide', {}); h[el.dataset.s] = !h[el.dataset.s]; render(); };
ACT['cal-move'] = (el) => { const a = parseKey(UI('cal.anchor', todayKey())); const d = num(el.dataset.d); if (UI('cal.mode', 'month') === 'month') a.setMonth(a.getMonth() + d, 1); else a.setDate(a.getDate() + 7 * d); S.ui['cal.anchor'] = dkey(a); render(); };

/* ============ Expenses ============ */
function expenseModal(e = {}, projectId) {
  const projects = D('projects').filter((p) => p.status !== 'cancelled' || p.id === e.projectId);
  openModal({
    title: e.id ? 'Edit expense' : 'New expense',
    body: `<div class="grid2">${F.text('date', 'Date', e.date || todayKey(), { type: 'date' })}${F.select('category', 'Category', EXPENSE_CATS, e.category || 'Materials')}
      ${F.text('amount', 'Amount paid (incl. tax)', e.amount ?? '', { type: 'number', step: '0.01', min: 0 })}<div class="field"><label for="f-hst">${esc(S.cfg.taxLabel)} on receipt</label><div class="row" style="flex-wrap:nowrap"><input class="inp" id="f-hst" name="hst" type="number" step="0.01" min="0" value="${esc(e.hst ?? '')}"><button class="btn btn-sm" type="button" id="hst-calc" title="Work out the tax included in the amount">${num(S.cfg.taxRate)}% incl.</button></div><div class="hint">Recoverable tax is left out of job cost.</div></div>
      ${F.text('vendor', 'Vendor', e.vendor, { ph: 'Home Depot, dump site, rental yard…' })}${F.select('projectId', 'Project', [['', '— Overhead / no project —'], ...projects.map((p) => [p.id, p.title])], e.projectId || projectId || '')}
      <div class="field" id="sub-field" style="${(e.category || 'Materials') === 'Subcontractor' ? '' : 'display:none'}"><label for="f-subId">Subcontractor</label><select class="inp" id="f-subId" name="subId"><option value="">—</option>${subList().map((s) => `<option value="${s.id}" ${e.subId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      ${F.area('description', 'Description', e.description, { rows: 2, ph: '4x4 PT posts ×22, concrete ×30 bags' })}</div>`,
    foot: `${e.id ? '<button class="btn btn-danger" id="exp-del" style="margin-right:auto">Delete</button>' : ''}<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="exp-ok">${e.id ? 'Save' : 'Add expense'}</button>`,
    onMount: (m) => {
      $('#f-category', m).onchange = (ev) => { $('#sub-field', m).style.display = ev.target.value === 'Subcontractor' ? '' : 'none'; };
      $('#hst-calc', m).onclick = () => { const a = num($('#f-amount', m).value); const r = num(S.cfg.taxRate) / 100; $('#f-hst', m).value = (a - a / (1 + r)).toFixed(2); };
      $('#exp-ok', m).onclick = async () => { const f = formData(m); if (!(num(f.amount) > 0)) { toast('Enter the amount paid.', 'bad'); return; } if (num(f.hst) > num(f.amount)) { toast('Tax can\'t be more than the amount.', 'bad'); return; } const body = { ...f, amount: round2(f.amount), hst: round2(f.hst), subId: f.category === 'Subcontractor' ? f.subId : '' }; if (e.id) await Store.update('expenses', e.id, body); else await Store.add('expenses', body); closeModal(); toast(e.id ? 'Expense saved' : 'Expense added'); };
      const d = $('#exp-del', m); if (d) d.onclick = () => confirmBox('Delete this expense?', 'Job cost and payroll update right away.', 'Delete', async () => { await Store.del('expenses', e.id); toast('Expense deleted'); });
    }
  });
}
ACT['exp-new'] = (el) => expenseModal({}, el.dataset.project);
ACT['exp-edit'] = (el) => expenseModal(byId('expenses', el.dataset.id));
ACT['exp-csv'] = () => saveFile(`expenses-${todayKey()}.csv`, csv([['Date', 'Category', 'Description', 'Project', 'Vendor', 'Amount', 'Tax', 'Net'], ...V.expenses.rows().map((e) => [e.date, e.category, e.description, (byId('projects', e.projectId) || {}).title || '', e.vendor || pname(e.subId), e.amount, e.hst || 0, expNet(e).toFixed(2)])]));
V.expenses = {
  render() {
    return pageHead({ eyebrow: 'Financial workspace', title: 'Expenses', lede: "Materials, gas, dump, equipment, permits, subcontractor, food, rental: every project cost that isn't crew labour.", acts: btn('Export CSV', 'exp-csv', { icon: 'download' }) + btn('New expense', 'exp-new', { cls: 'btn-primary', icon: 'plus' }) })
      + `<div class="panel filters"><div class="frow">${searchBox('exp.q', 'Description, vendor, notes…')}<select class="inp" style="width:220px" data-fsel="exp.pj" aria-label="Project">${[['all', 'All projects'], ['none', 'No project (overhead)'], ...D('projects').map((p) => [p.id, p.title])].map(([v, l]) => `<option value="${v}" ${UI('exp.pj', 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><input class="inp" style="width:170px" type="date" data-fsel="exp.from" value="${esc(S.ui['exp.from'] || '')}" aria-label="From"><input class="inp" style="width:170px" type="date" data-fsel="exp.to" value="${esc(S.ui['exp.to'] || '')}" aria-label="To"></div>
      <div><div class="lbl">Categories</div>${chips('exp.cat', [['all', 'All'], ...EXPENSE_CATS.map((c) => [c, c])], UI('exp.cat', 'all'))}</div></div><div id="results">${this.results()}</div>`;
  },
  rows() { const c = UI('exp.cat', 'all'), pj = UI('exp.pj', 'all'), q = S.ui['exp.q'], fr = S.ui['exp.from'], to = S.ui['exp.to']; return D('expenses').filter((e) => (c === 'all' || e.category === c) && (pj === 'all' || (pj === 'none' ? !e.projectId : e.projectId === pj)) && (!fr || e.date >= fr) && (!to || e.date <= to) && match(q, e.description, e.vendor, pname(e.subId))).sort((a, b) => String(b.date).localeCompare(String(a.date))); },
  results() {
    if (!ready('expenses')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const rows = this.rows(); const pg = pager('exp', rows.length);
    if (!rows.length) return `<div class="count"><b>0</b> expenses · total <b>${money(0)}</b></div><div class="panel">${emptyBox('receipt', 'No expenses match.', 'Adjust filters or record a new one.', btn('New expense', 'exp-new', { cls: 'btn-primary', icon: 'plus' }))}</div>`;
    return `<div class="count"><b>${rows.length}</b> expenses · total <b>${money(sum(rows, (e) => e.amount))}</b> · net of tax <b>${money(sum(rows, expNet))}</b></div><div class="panel tablewrap"><table class="t"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Project</th><th>Vendor</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead><tbody>${pg.slice(rows).map((e) => `<tr class="click" data-act="exp-edit" data-id="${e.id}" tabindex="0"><td class="small nw">${fmtDate(e.date)}</td><td><span class="badge c-grey">${esc(e.category)}</span>${exTag(e)}</td><td>${esc(e.description || '—')}</td><td class="small">${esc((byId('projects', e.projectId) || {}).title || 'Overhead')}</td><td>${esc(e.vendor || pname(e.subId) || '—')}</td><td class="r num small muted">${num(e.hst) ? money(e.hst) : '—'}</td><td class="r num strong">${money(e.amount)}</td></tr>`).join('')}</tbody></table></div>${pg.html}`;
  }
};

/* ============ Overhead ============ */
ACT['oh-new'] = (el) => ohModal(el.dataset.id ? byId('overhead', el.dataset.id) : {});
function ohModal(o) {
  if (!S.isAdmin) { toast('Only the owner and editors can change overhead.', 'bad'); return; }
  openModal({ title: o.id ? 'Edit overhead cost' : 'Add overhead cost', body: `<div class="grid2">${F.text('name', 'Name', o.name, { req: true, ph: 'Shop rent, truck lease, insurance…', span: true })}${F.select('category', 'Category', ['Rent', 'Vehicles', 'Insurance', 'Software', 'Marketing', 'Utilities', 'Salaries', 'Other'], o.category || 'Other')}${F.text('monthly', 'Monthly amount', o.monthly ?? '', { type: 'number', step: '0.01' })}</div>`,
    foot: `${o.id ? '<button class="btn btn-danger" id="oh-del" style="margin-right:auto">Delete</button>' : ''}<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="oh-ok">Save</button>`,
    onMount: (m) => { $('#oh-ok', m).onclick = async () => { const f = formData(m); if (!f.name) { toast('Name is required.', 'bad'); return; } const body = { ...f, monthly: round2(f.monthly) }; if (o.id) await Store.update('overhead', o.id, body); else await Store.add('overhead', body); closeModal(); toast('Saved'); }; const d = $('#oh-del', m); if (d) d.onclick = async () => { await Store.del('overhead', o.id); closeModal(); toast('Deleted'); }; } });
}
V.overhead = {
  render() {
    const rows = D('overhead').slice().sort((a, b) => num(b.monthly) - num(a.monthly));
    const tot = sum(rows, (o) => o.monthly);
    return pageHead({ eyebrow: 'Financial workspace', title: 'Overhead', lede: 'Fixed monthly costs of running the business. Insights subtracts them to show net profit.', acts: S.isAdmin ? btn('Add cost', 'oh-new', { cls: 'btn-primary', icon: 'plus' }) : '' })
      + `<div class="tiles" style="margin-bottom:20px"><div class="tile"><div class="k">Monthly overhead</div><div class="v">${money0(tot)}</div><div class="s">${rows.length} line${rows.length === 1 ? '' : 's'}</div></div><div class="tile" style="--c:var(--info)"><div class="k">Annual</div><div class="v">${money0(tot * 12)}</div><div class="s">At today's rates</div></div><div class="tile" style="--c:var(--violet)"><div class="k">Daily burn</div><div class="v">${money0(tot / 30.44)}</div><div class="s">What each day costs before any job</div></div></div>
      <div class="panel tablewrap">${!ready('overhead') ? loadingRows() : rows.length ? `<table class="t"><thead><tr><th>Name</th><th>Category</th><th class="r">Monthly</th><th class="r">Annual</th></tr></thead><tbody>${rows.map((o) => `<tr class="click" data-act="oh-new" data-id="${o.id}"><td class="cell-main">${esc(o.name)}${exTag(o)}</td><td>${esc(o.category)}</td><td class="r num">${money(o.monthly)}</td><td class="r num">${money(num(o.monthly) * 12)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total</td><td class="r num">${money(tot)}</td><td class="r num">${money(tot * 12)}</td></tr></tfoot></table>` : emptyBox('building', 'No overhead data', 'Add rent, vehicles, insurance and software so net profit is accurate.', S.isAdmin ? btn('Add cost', 'oh-new', { cls: 'btn-primary', icon: 'plus' }) : '')}</div>`;
  }
};

/* ============ Payroll: crew & subs ledger ============ */
function payees(r) {
  const labor = D('projects').flatMap((p) => (p.labor || []).map((l) => ({ ...l, projectId: p.id })));
  const outs = D('payouts');
  const crew = crewList().map((c) => {
    const mine = labor.filter((l) => l.memberId === c.id);
    const win = mine.filter((l) => inR(l.date, r));
    const paidAll = sum(outs.filter((o) => o.payeeId === c.id), (o) => o.amount);
    return { p: c, kind: 'crew', hours: sum(win, (l) => l.hours), accrued: sum(win, (l) => num(l.hours) * num(l.rate)), paid: sum(outs.filter((o) => o.payeeId === c.id && inR(o.date, r)), (o) => o.amount), balance: round2(sum(mine, (l) => num(l.hours) * num(l.rate)) - paidAll) };
  });
  const subs = subList().map((s) => {
    const ex = D('expenses').filter((e) => e.category === 'Subcontractor' && e.subId === s.id);
    const paidAll = sum(outs.filter((o) => o.payeeId === s.id), (o) => o.amount);
    return { p: s, kind: 'sub', hours: 0, accrued: sum(ex.filter((e) => inR(e.date, r)), (e) => e.amount), paid: sum(outs.filter((o) => o.payeeId === s.id && inR(o.date, r)), (o) => o.amount), balance: round2(sum(ex, (e) => e.amount) - paidAll) };
  });
  return { crew, subs };
}
ACT['pay-out'] = (el) => {
  if (!S.isAdmin) { toast('Only the owner and editors can record payroll payments.', 'bad'); return; }
  const p = byId('team', el.dataset.id); const bal = num(el.dataset.bal);
  openModal({ title: `Pay ${p.name}`, body: `<div class="grid2">${F.text('amount', 'Amount', bal > 0 ? bal.toFixed(2) : '', { type: 'number', step: '0.01', min: 0 })}${F.text('date', 'Date', todayKey(), { type: 'date' })}${F.select('method', 'Method', PAY_METHODS, 'E-transfer')}${F.text('note', 'Note', '', { ph: 'Week of…' })}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="po-ok">Record payment</button>`,
    onMount: (m) => { $('#po-ok', m).onclick = async () => { const f = formData(m); if (!(num(f.amount) > 0)) { toast('Enter an amount.', 'bad'); return; } await Store.add('payouts', { payeeId: p.id, payeeType: p.type, amount: round2(f.amount), date: f.date, method: f.method, note: f.note }); closeModal(); toast('Payment recorded'); }; } });
};
ACT['payout-del'] = (el) => confirmBox('Delete this payment record?', 'The payee\'s balance goes back up.', 'Delete', async () => { await Store.del('payouts', el.dataset.id); toast('Deleted'); });
ACT['pay-csv'] = () => { const { crew, subs } = payees(rangeOf(UI('pay.win', 'all'))); saveFile(`payroll-${todayKey()}.csv`, csv([['Payee', 'Type', 'Hours', 'Accrued (window)', 'Paid (window)', 'Balance owed'], ...crew.concat(subs).map((x) => [x.p.name, x.kind, x.hours.toFixed(2), x.accrued.toFixed(2), x.paid.toFixed(2), x.balance.toFixed(2)])])); };
V.payroll = {
  render() {
    const win = UI('pay.win', 'all'), who = UI('pay.who', 'all'), st = UI('pay.st', 'all');
    const r = rangeOf(win);
    let { crew, subs } = payees(r);
    const m = myMember();
    if ((S.role === 'CREW' || S.role === 'CREW_LEAD') && m) { crew = crew.filter((x) => x.p.id === m.id); subs = []; }
    const q = S.ui['pay.q'];
    const f = (x) => match(q, x.p.name) && (st === 'all' || (st === 'unpaid' ? x.balance > 0.005 : x.balance <= 0.005));
    crew = crew.filter(f); subs = subs.filter(f);
    const all = (who === 'all' || who === 'crew' ? crew : []).concat(who === 'all' || who === 'subs' ? subs : []);
    const table = (rows, kind) => rows.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>${kind === 'crew' ? 'Crew member' : 'Subcontractor'}</th><th>${kind === 'crew' ? 'Rate' : 'Trade'}</th>${kind === 'crew' ? '<th class="r">Hours</th>' : ''}<th class="r">${kind === 'crew' ? 'Earned' : 'Invoiced'}</th><th class="r">Paid</th><th class="r">Balance owed</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><div class="cell-main">${esc(x.p.name)}${exTag(x.p)}</div><div class="cell-sub">${esc(ROLES[x.p.role] || (kind === 'sub' ? 'Subcontractor' : ''))}</div></td><td class="small">${kind === 'crew' ? money(x.p.hourlyRate) + '/h' : esc(x.p.trade || '—')}</td>${kind === 'crew' ? `<td class="r num">${x.hours.toFixed(1)}</td>` : ''}<td class="r num">${money(x.accrued)}</td><td class="r num">${money(x.paid)}</td><td class="r num strong" style="${x.balance > 0.005 ? 'color:var(--danger)' : ''}">${money(x.balance)}</td><td class="r">${S.isAdmin ? btn('Pay', 'pay-out', { cls: 'btn-xs', attrs: `data-id="${x.p.id}" data-bal="${x.balance}"` }) : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="mini-empty">${kind === 'crew' ? 'No crew members yet. Add them in Team with an hourly rate.' : 'No subcontractors yet. Add them in Team, then record their invoices as Subcontractor expenses.'}</div>`;
    const outs = D('payouts').filter((o) => inR(o.date, r)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 25);
    return pageHead({ eyebrow: `<span class="accent" style="color:var(--primary)">${esc(S.cfg.name)} payroll</span>`, title: 'Crew & Subs Ledger', lede: 'Live payable and paid balances across every project. Crew earns from logged hours; subs from their invoices recorded as Subcontractor expenses.', acts: btn('Export CSV', 'pay-csv', { icon: 'download' }) })
      + `<div class="panel filters"><div class="row">${chips('pay.who', [['all', 'All payees'], ['crew', 'Crew'], ['subs', 'Subcontractors']], who)}</div><div class="row">${chips('pay.win', [['week', 'This week'], ['mtd', 'This month'], ['30d', 'Last 30 days'], ['ytd', 'YTD'], ['all', 'All time']], win)}</div><div class="frow">${chips('pay.st', [['all', 'All'], ['unpaid', 'Owed'], ['paid', 'Settled']], st)}<input class="inp inp-sm" style="max-width:260px" data-fsel="pay.q" value="${esc(q || '')}" placeholder="Filter by payee name…" aria-label="Filter by payee"></div></div>
      <div class="tiles" style="margin:20px 0">${[['Total earned', sum(all, (x) => x.accrued), 'var(--primary)', 'In the selected window'], ['Total paid', sum(all, (x) => x.paid), 'var(--ok)', 'In the selected window'], ['Outstanding balance', sum(all, (x) => Math.max(0, x.balance)), 'var(--danger)', 'Owed right now, all time']].map(([k, v, c, s]) => `<div class="tile" style="--c:${c}"><div class="k">${k}</div><div class="v">${money(v)}</div><div class="s">${s}</div></div>`).join('')}</div>
      <div class="stack">${who !== 'subs' ? `<div class="panel"><div class="panel-h"><h2 class="h2">${icon('hardhat')} Crew</h2><span class="badge c-grey">${crew.length} rows</span></div>${table(crew, 'crew')}</div>` : ''}
      ${who !== 'crew' && S.role !== 'CREW' && S.role !== 'CREW_LEAD' ? `<div class="panel"><div class="panel-h"><h2 class="h2">${icon('truck')} Subcontractors</h2><span class="badge c-grey">${subs.length} rows</span></div>${table(subs, 'sub')}</div>` : ''}
      <div class="panel"><div class="panel-h"><h2 class="h2">Payments in this window</h2></div>${outs.length ? `<div class="list">${outs.map((o) => `<div class="li"><span class="mono small">${fmtShort(o.date)}</span><div class="grow"><b>${esc(pname(o.payeeId) || 'Removed payee')}</b> <span class="xs muted">${esc(o.payeeType === 'rep' ? 'commission' : o.payeeType)} · ${esc(o.method || '')}${o.note ? ' · ' + esc(o.note) : ''}</span></div><span class="num strong">${money(o.amount)}</span>${S.isAdmin ? `<button class="iconbtn" data-act="payout-del" data-id="${o.id}" aria-label="Delete payment">${icon('trash')}</button>` : ''}</div>`).join('')}</div>` : '<div class="mini-empty">No payments recorded in this window.</div>'}</div></div>`;
  }
};

/* ============ Rep commissions ============ */
function commissionRows() {
  return D('invoices').filter((i) => i.repId && !i.void).map((i) => {
    const { rep, amount } = invCommission(i);
    const out = D('payouts').find((o) => o.payeeType === 'rep' && o.invoiceId === i.id);
    const state = out ? 'paid' : invStatus(i) === 'paid' ? 'payable' : 'pending';
    return { i, rep, amount, out, state };
  }).filter((x) => x.rep);
}
ACT['comm-pay'] = async (el) => { if (!S.isAdmin) { toast('Only the owner and editors can mark commissions paid.', 'bad'); return; } const x = commissionRows().find((r) => r.i.id === el.dataset.id); await Store.add('payouts', { payeeId: x.rep.id, payeeType: 'rep', invoiceId: x.i.id, amount: x.amount, date: todayKey(), method: 'E-transfer', note: `Commission on ${x.i.number}` }); toast('Commission marked paid'); };
V.commissions = {
  render() {
    const st = UI('com.st', 'all'), rep = UI('com.rep', 'all');
    let rows = commissionRows();
    const m = myMember(); if (S.role === 'REP' && m) rows = rows.filter((x) => x.rep.id === m.id);
    const shown = rows.filter((x) => (st === 'all' || x.state === st) && (rep === 'all' || x.rep.id === rep));
    const tot = (s) => sum(rows.filter((x) => x.state === s), (x) => x.amount);
    const CS = [['pending', 'Pending', 'c-warn'], ['payable', 'Payable', 'c-pri'], ['paid', 'Paid', 'c-ok']];
    return pageHead({ eyebrow: 'Payroll', title: 'Rep Commissions', lede: 'Commission is the rep\'s % of the invoice\'s pre-tax value. It becomes payable once the client pays in full.' })
      + `<div class="tiles" style="margin-bottom:20px"><div class="tile" style="--c:var(--warn)"><div class="k">Pending</div><div class="v">${money0(tot('pending'))}</div><div class="s">Invoice not fully paid yet</div></div><div class="tile"><div class="k">Payable now</div><div class="v">${money0(tot('payable'))}</div><div class="s">Client paid, rep not yet paid</div></div><div class="tile" style="--c:var(--ok)"><div class="k">Paid</div><div class="v">${money0(tot('paid'))}</div><div class="s">All time</div></div></div>
      <div class="panel filters"><div class="frow">${chips('com.st', [['all', 'All'], ...CS], st)}<select class="inp inp-sm" style="width:200px" data-fsel="com.rep" aria-label="Rep">${[['all', 'All reps'], ...repList().map((r) => [r.id, r.name])].map(([v, l]) => `<option value="${v}" ${rep === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>
      <div class="panel tablewrap" style="margin-top:20px">${shown.length ? `<table class="t"><thead><tr><th>Invoice</th><th>Client</th><th>Rep</th><th class="r">Pre-tax value</th><th class="r">Rate</th><th class="r">Commission</th><th>Status</th><th></th></tr></thead><tbody>${shown.map((x) => `<tr><td><button class="linkbtn mono" data-go="invoice" data-param="${x.i.id}">${esc(x.i.number)}</button></td><td>${esc(x.i.client && x.i.client.name)}</td><td>${esc(x.rep.name)}</td><td class="r num">${money(invNet(x.i))}</td><td class="r num">${num(x.rep.commissionPct)}%</td><td class="r num strong">${money(x.amount)}</td><td>${badge(CS, x.state)}</td><td class="r">${x.state === 'payable' && S.isAdmin ? btn('Mark paid', 'comm-pay', { cls: 'btn-xs', attrs: `data-id="${x.i.id}"` }) : ''}</td></tr>`).join('')}</tbody></table>` : emptyBox('percent', 'No commissions yet', 'Set a commission % on each rep in Team, then attribute quotes to reps.')}</div>`;
  }
};

/* ============ Cost & profit analysis ============ */
V.profit = {
  render() {
    const win = UI('pf.win', 'ytd'), done = UI('pf.done', false); const r = rangeOf(win);
    const rows = D('projects').map((p) => ({ p, f: projectFin(p) })).filter(({ p, f }) => (!done || p.status === 'completed') && p.status !== 'cancelled' && (f.inv ? inR(f.inv.issueDate, r) : inR(p.start || p.createdAt, r)) && (f.revenue || f.cost));
    const sort = UI('pf.sort', 'margin');
    rows.sort((a, b) => sort === 'margin' ? (b.f.margin ?? -9) - (a.f.margin ?? -9) : sort === 'profit' ? b.f.profit - a.f.profit : b.f.revenue - a.f.revenue);
    const T = (k) => sum(rows, (x) => x.f[k]);
    const rev = T('revenue'), prof = T('profit'), oh = sum(D('overhead'), (o) => o.monthly) * (() => { const first = [...D('invoices').map((i) => i.issueDate), ...D('projects').map((p) => p.start)].filter(Boolean).sort()[0] || todayKey(); return monthsIn({ from: r.from > first ? r.from : first, to: r.to > todayKey() ? todayKey() : r.to }); })();
    return pageHead({ eyebrow: 'Financial workspace', title: 'Cost & Profit Analysis', lede: 'Job costing for every project: revenue against crew labour, materials, subcontractors and commission.' })
      + `<div class="panel filters"><div class="row">${chips('pf.win', RANGES, win)}</div><div class="row"><span class="lbl">Sort</span>${chips('pf.sort', [['margin', 'Margin %'], ['profit', 'Profit $'], ['revenue', 'Revenue']], sort)}<button class="chip ${done ? 'on' : ''}" data-act="ui" data-k="pf.done" data-v="${!done}" style="margin-top:8px">Completed only</button></div></div>
      <div class="tiles" style="margin:20px 0"><div class="tile" style="--c:var(--info)"><div class="k">Revenue</div><div class="v">${money0(rev)}</div><div class="s">${rows.length} projects · pre-tax</div></div><div class="tile" style="--c:var(--warn)"><div class="k">Direct costs</div><div class="v">${money0(T('cost'))}</div><div class="s">Labour ${money0(T('labor'))} · materials ${money0(T('materials'))} · subs ${money0(T('subs'))}</div></div><div class="tile" style="--c:var(--ok)"><div class="k">Gross profit</div><div class="v">${money0(prof)}</div><div class="s">${rev ? pct(prof / rev, 1) + ' margin' : '—'}</div></div><div class="tile" style="--c:var(--violet)"><div class="k">After overhead</div><div class="v">${money0(prof - oh)}</div><div class="s">${money0(oh)} overhead in window</div></div></div>
      <div class="panel tablewrap">${rows.length ? `<table class="t"><thead><tr><th>Project</th><th>Status</th><th class="r">Revenue</th><th class="r">Labour</th><th class="r">Materials</th><th class="r">Subs</th><th class="r">Commission</th><th class="r">Profit</th><th class="r">Margin</th></tr></thead><tbody>${rows.map(({ p, f }) => `<tr class="click" data-go="project" data-param="${p.id}"><td class="cell-main">${esc(p.title)}${exTag(p)}</td><td>${badge(PROJECT_STATUS, p.status)}</td><td class="r num">${money0(f.revenue)}</td><td class="r num">${money0(f.labor)}</td><td class="r num">${money0(f.materials)}</td><td class="r num">${money0(f.subs)}</td><td class="r num">${money0(f.commission)}</td><td class="r num strong" style="color:${f.profit < 0 ? 'var(--danger)' : 'inherit'}">${money0(f.profit)}</td><td class="r"><span class="badge ${f.margin == null ? 'c-grey' : f.margin < 0.2 ? 'c-bad' : f.margin < 0.35 ? 'c-warn' : 'c-ok'}">${pct(f.margin, 1)}</span></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total</td><td class="r num">${money0(rev)}</td><td class="r num">${money0(T('labor'))}</td><td class="r num">${money0(T('materials'))}</td><td class="r num">${money0(T('subs'))}</td><td class="r num">${money0(T('commission'))}</td><td class="r num">${money0(prof)}</td><td class="r">${rev ? pct(prof / rev, 1) : '—'}</td></tr></tfoot></table>` : emptyBox('box', 'No projects in this window', 'Projects with revenue or costs show up here.')}</div>`;
  }
};

/* ============ Insights ============ */
function trendSVG(months) {
  const W = 720, H = 200, P = { l: 56, r: 12, t: 12, b: 28 };
  const mx = Math.max(1, ...months.map((m) => Math.max(m.rev, m.prof)));
  const step = Math.pow(10, Math.floor(Math.log10(mx))); const top = Math.ceil(mx / step) * step;
  const bw = (W - P.l - P.r) / months.length;
  const y = (v) => P.t + (H - P.t - P.b) * (1 - Math.max(0, v) / top);
  const ticks = [0, 0.5, 1].map((f) => top * f);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Monthly revenue and gross profit">
    ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/><text x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end" font-size="10" fill="var(--muted-fg)" font-family="var(--font-mono)">${money0(t).replace(/,000$/, 'k')}</text>`).join('')}
    ${months.map((m, i) => { const x = P.l + i * bw; return `<rect x="${x + bw * 0.14}" y="${y(m.rev)}" width="${bw * 0.34}" height="${H - P.b - y(m.rev)}" fill="var(--primary)"><title>${m.label}: revenue ${money0(m.rev)}</title></rect><rect x="${x + bw * 0.52}" y="${y(m.prof)}" width="${bw * 0.34}" height="${H - P.b - y(m.prof)}" fill="var(--ok)"><title>${m.label}: gross profit ${money0(m.prof)}</title></rect><text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--muted-fg)">${m.label}</text>`; }).join('')}
  </svg>`;
}
V.insights = {
  render() {
    const k = UI('ins.win', 'ytd'); const r = rangeOf(k);
    const head = pageHead({ eyebrow: `<span style="color:var(--primary)">${esc(S.cfg.name)} insights</span>`, title: 'Dashboards', lede: 'Margin, cash and pipeline for any window. Revenue is pre-tax unless noted.' });
    if (!ready('invoices', 'projects', 'quotes', 'leads', 'expenses')) return head + `<div class="panel">${loadingRows()}</div>`;
    const inv = D('invoices').filter((i) => !i.void && inR(i.issueDate, r));
    const revGross = sum(inv, (i) => i.total), taxC = sum(inv, (i) => i.tax), rev = revGross - taxC;
    const pendQ = D('quotes').filter((q) => ['pending', 'follow_up'].includes(quoteStatus(q)) && inR(q.sentAt || q.createdAt, r));
    const awaiting = sum(D('invoices').filter((i) => invOpen(i) && inR(i.issueDate, r)), invDue);
    const labor = sum(D('projects').flatMap((p) => (p.labor || []).filter((l) => inR(l.date, r))), (l) => num(l.hours) * num(l.rate)) + sum(D('expenses').filter((e) => e.category === 'Labor' && inR(e.date, r)), expNet);
    const subs = sum(D('expenses').filter((e) => e.category === 'Subcontractor' && inR(e.date, r)), expNet);
    const mats = sum(D('expenses').filter((e) => e.projectId && !['Subcontractor', 'Labor'].includes(e.category) && inR(e.date, r)), expNet);
    const comm = sum(inv, (i) => invCommission(i).amount);
    const gp = rev - labor - subs - mats - comm;
    const first = [...D('invoices').map((i) => i.issueDate), ...D('projects').map((p) => p.start), ...D('expenses').map((e) => e.date)].filter(Boolean).sort()[0] || todayKey();
    const ohSpan = { from: r.from > first ? r.from : first, to: r.to > todayKey() ? todayKey() : r.to };
    const ohDirect = sum(D('expenses').filter((e) => !e.projectId && inR(e.date, r)), expNet);
    const oh = sum(D('overhead'), (o) => o.monthly) * monthsIn(ohSpan) + ohDirect;
    const tile = (k2, v, s, c) => `<div class="tile" style="--c:${c}"><div class="k">${k2}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    const tiles = `<div class="tiles">${tile('Invoiced revenue', money0(revGross), `${inv.length} invoices · includes ${esc(S.cfg.taxLabel)}`, 'var(--primary)')}${tile('Pending approval', money0(sum(pendQ, quoteValue)), `${pendQ.length} quotes sent in window`, 'var(--violet)')}${tile('Awaiting payment', money0(awaiting), 'Issued in window, not yet paid', 'var(--info)')}${tile('Gross profit', money0(gp), rev ? pct(gp / rev, 1) + ' margin · excludes ' + esc(S.cfg.taxLabel) : 'No revenue in window', 'var(--ok)')}${tile('Labour cost', money0(labor), 'Logged crew hours × rate', 'var(--warn)')}${tile('Subcontractor pay', money0(subs), 'Sub invoices, net of tax', 'var(--warn)')}${tile('Project expenses', money0(mats), 'Materials, dump, rentals… net of tax', 'var(--warn)')}${tile('Rep commissions', money0(comm), 'On invoices issued in window', 'var(--warn)')}${tile(`${esc(S.cfg.taxLabel)} collected`, money0(taxC), 'Charged on invoices in window', 'var(--muted-fg)')}${tile('Net profit after overhead', money0(gp - oh), `${money0(oh)} overhead in window`, gp - oh < 0 ? 'var(--danger)' : 'var(--ok)')}</div>`;
    const open = D('invoices').filter(invOpen);
    const buckets = [[1, 30, '1–30 days'], [31, 60, '31–60 days'], [61, 90, '61–90 days'], [91, 99999, '90+ days']].map(([a, b, l]) => { const x = open.filter((i) => { const d = invOverdueDays(i); return d >= a && d <= b; }); return { l, n: x.length, v: sum(x, invDue) }; });
    const aging = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Overdue invoices · aging</div><div class="sub">Past the due date and still unpaid. Not affected by the window above.</div></div><button class="btn btn-sm" data-act="goto-overdue">View</button></div><div class="pad grid4">${buckets.map((b, i) => `<div class="tile" style="--c:${['var(--warn)', 'var(--primary)', 'var(--danger)', 'var(--danger)'][i]}"><div class="k">${b.l}</div><div class="v">${money0(b.v)}</div><div class="s">${b.n} invoice${b.n === 1 ? '' : 's'}</div></div>`).join('')}</div></div>`;
    const t = new Date(); const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); const mr = { from: dkey(d), to: dkey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; const mi = D('invoices').filter((x) => !x.void && inR(x.issueDate, mr)); const pj = D('projects').filter((p) => mi.some((x) => x.id === p.invoiceId)).map(projectFin); months.push({ label: d.toLocaleDateString('en-CA', { month: 'short' }), rev: sum(mi, invNet), prof: sum(pj, (f) => f.profit) }); }
    const trend = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Monthly trend</div><div class="sub">Last 12 months · invoiced revenue (pre-tax) <span style="color:var(--primary)">■</span> and gross profit of those jobs <span style="color:var(--ok)">■</span></div></div></div><div class="pad tablewrap"><div style="min-width:520px">${trendSVG(months)}</div></div></div>`;
    const leads = D('leads').filter((l) => inR(l.createdAt, r));
    const src = S.cfg.sources.map((s) => { const x = leads.filter((l) => l.source === s); return { s, n: x.length, won: x.filter((l) => l.customer).length }; }).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const mx = Math.max(1, ...src.map((x) => x.n));
    const srcP = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Lead source</div><div class="sub">Leads created in window · bar shows won share</div></div></div>${src.length ? `<div class="bars">${src.map((x) => `<div class="bar"><span class="trunc">${esc(x.s)}</span><div class="track"><div class="fill alt" style="width:${(x.n / mx) * 100}%"></div><div class="fill" style="width:${(x.won / mx) * 100}%"></div></div><span class="num small" style="text-align:right">${x.n} · ${pct(x.won / x.n)}</span></div>`).join('')}</div>` : '<div class="mini-empty">No leads in this window yet.</div>'}</div>`;
    const lb = repList().map((rp) => { const qs = D('quotes').filter((q) => q.repId === rp.id && inR(q.createdAt, r)); const won = qs.filter((q) => ['approved', 'scheduled', 'in_progress', 'paid'].includes(q.status)); const iv = inv.filter((i) => i.repId === rp.id); return { rp, q: qs.length, won: won.length, rev: sum(iv, invNet) }; }).sort((a, b) => b.rev - a.rev);
    const lbP = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Leaderboard</div><div class="sub">Reps by invoiced revenue in window</div></div></div>${lb.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Rep</th><th class="r">Quotes</th><th class="r">Won</th><th class="r">Close rate</th><th class="r">Revenue</th></tr></thead><tbody>${lb.map((x) => `<tr><td class="cell-main">${esc(x.rp.name)}</td><td class="r num">${x.q}</td><td class="r num">${x.won}</td><td class="r num">${x.q ? pct(x.won / x.q) : '—'}</td><td class="r num strong">${money0(x.rev)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mini-empty">Add reps in Team to see the leaderboard.</div>'}</div>`;
    const svc = S.cfg.services.map((s) => { const qs = D('quotes').filter((q) => q.service === s && inR(q.createdAt, r)); return { s, n: qs.length, v: sum(qs.filter((q) => ['approved', 'scheduled', 'in_progress', 'paid'].includes(q.status)), quoteValue) }; }).filter((x) => x.n).sort((a, b) => b.v - a.v);
    const svcP = `<div class="panel"><div class="panel-h"><div><div class="eyebrow">Services</div><div class="sub">Quotes and won value by service</div></div></div>${svc.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Service</th><th class="r">Quotes</th><th class="r">Won value</th></tr></thead><tbody>${svc.map((x) => `<tr><td>${esc(x.s)}</td><td class="r num">${x.n}</td><td class="r num strong">${money0(x.v)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mini-empty">No quotes in this window yet.</div>'}</div>`;
    return head + `<div class="panel filters" style="margin-bottom:20px"><div class="row"><span class="lbl">Window</span>${chips('ins.win', RANGES, k)}</div><div class="xs muted">${fmtDate(r.from === '2000-01-01' ? null : r.from)} → ${fmtDate(r.to === '2999-12-31' ? todayKey() : r.to)}</div></div>${tiles}<div class="stack" style="margin-top:20px">${aging}${trend}<div class="grid2">${srcP}${lbP}</div>${svcP}</div>`;
  }
};
