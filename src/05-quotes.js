/* ============ Quotes list ============ */
V.quotes = {
  render() {
    return pageHead({ eyebrow: 'Pipeline · Quotes', title: 'Quotes', lede: 'Build quotes, generate branded PDFs, and track follow-ups through to paid.', acts: btn('New quote', null, { go: 'quote', param: 'new', cls: 'btn-primary', icon: 'plus' }) })
      + `<div class="panel filters"><div class="frow">${searchBox('quotes.q', 'Search ref, client or title')}<select class="inp" style="width:200px" data-fsel="quotes.rep" aria-label="Rep">${[['all', 'All reps'], ...repList().map((r) => [r.id, r.name])].map(([v, l]) => `<option value="${v}" ${UI('quotes.rep', 'all') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div><div class="lbl">Status</div>${chips('quotes.status', [['all', 'All'], ...QUOTE_STATUS.map(([v, l]) => [v, l, D('quotes').filter((q) => quoteStatus(q) === v).length || null])], UI('quotes.status', 'all'), { reset: 'quotes.page' })}</div></div><div id="results">${this.results()}</div>`;
  },
  results() {
    if (!ready('quotes')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const st = UI('quotes.status', 'all'), rep = UI('quotes.rep', 'all'), q = S.ui['quotes.q'];
    const rows = D('quotes').filter((x) => (st === 'all' || quoteStatus(x) === st) && (rep === 'all' || x.repId === rep) && match(q, x.ref, x.client && x.client.name, x.title, x.siteAddress)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const pg = pager('quotes', rows.length);
    if (!rows.length) return `<div class="count"><b>0</b> of <b>${D('quotes').length}</b> quotes</div><div class="panel">${emptyBox('briefcase', D('quotes').length ? 'No quotes match your filters' : 'No quotes yet', 'Adjust the filters or draft a new quote to get rolling.', btn('New quote', null, { go: 'quote', param: 'new', cls: 'btn-primary', icon: 'plus' }))}</div>`;
    return `<div class="count"><b>${rows.length}</b> of <b>${D('quotes').length}</b> quotes · <b>${money0(sum(rows, quoteValue))}</b> total value</div><div class="panel tablewrap"><table class="t"><thead><tr><th>Ref</th><th>Client / title</th><th>Rep</th><th>Status</th><th>Options</th><th class="r">Value</th><th>Follow-up</th><th>Created</th></tr></thead><tbody>
      ${pg.slice(rows).map((x) => `<tr class="click" data-go="quote" data-param="${x.id}" tabindex="0"><td class="mono small">${esc(x.ref)}</td><td><div class="cell-main">${esc((x.client && x.client.name) || '—')}${exTag(x)}</div><div class="cell-sub trunc" style="max-width:340px">${esc(x.title || '')}</div></td><td>${esc(pname(x.repId) || '—')}</td><td>${badge(QUOTE_STATUS, quoteStatus(x))}</td><td class="small muted">${(x.options || []).length}${(x.options || []).some((o) => o.accepted) ? ' · accepted ' + (x.options || []).map((o, i) => (o.accepted ? 'ABCDE'[i] : '')).join('') : ''}</td><td class="r num strong">${money0(quoteValue(x))}</td><td class="small">${['pending', 'follow_up', 'expired'].includes(quoteStatus(x)) ? fuCell(x.followUpAt) : '<span class="muted">—</span>'}</td><td class="small muted">${fmtDate(x.createdAt)}</td></tr>`).join('')}</tbody></table></div>${pg.html}`;
  }
};

/* ============ Quote editor ============ */
const newItem = () => ({ id: uid(), description: '', qty: 1, unit: 'ea', rate: 0, included: false });
const newOption = () => ({ id: uid(), title: '', description: '', taxType: 'tax', items: [newItem()], accepted: false });
function blankQuote(lead) {
  return {
    ref: '', status: 'new', leadId: lead ? lead.id : '', repId: lead ? lead.repId || '' : (myMember() && myMember().type === 'rep' ? myMember().id : ''),
    client: lead ? { name: lead.name, phone: lead.phone || '', email: lead.email || '', address: lead.address || '' } : { name: '', phone: '', email: '', address: '' },
    category: lead ? lead.category || 'Residential' : 'Residential', service: lead ? lead.service || '' : '', source: lead ? lead.source || '' : S.cfg.sources[0],
    title: '', subtitle: '', siteAddress: lead ? lead.address || '' : '', description: '',
    options: [newOption()], discount: { type: 'none', value: 0, label: '', applies: 'pre' },
    includeWarranty: true, warranty: S.cfg.warranty, terms: S.cfg.paymentTerms, validityDays: num(S.cfg.quoteValidity) || 30, notes: '', activity: []
  };
}
ACT['quote-from-lead'] = (el) => { S.ui.quoteSeedLead = el.dataset.id; go('quote', 'new'); };

V.quote = {
  draft() {
    if (S.draft && S.draft.__for === S.param) {
      const live = S.param !== 'new' && byId('quotes', S.param);
      if (!(live && !S.dirty && live.updatedAt !== S.draft.updatedAt)) return S.draft;
      S.draft = { ...clone(live), __for: S.param }; return S.draft;
    }
    if (S.param === 'new') { const lead = byId('leads', S.ui.quoteSeedLead); delete S.ui.quoteSeedLead; S.draft = { ...blankQuote(lead), __for: 'new' }; }
    else { const q = byId('quotes', S.param); if (!q) return null; S.draft = { ...clone(q), __for: S.param }; }
    S.ui['q.opt'] = 0; S.dirty = false;
    return S.draft;
  },
  render() {
    const back = `<button class="back" data-go="quotes">${icon('arrowL')}Back to quotes</button>`;
    if (S.param !== 'new' && !ready('quotes')) return back + `<div class="panel">${loadingRows()}</div>`;
    const q = this.draft();
    if (!q) return back + `<div class="panel">${emptyBox('briefcase', 'Quote not found', 'It may have been deleted.')}</div>`;
    const isNew = !q.id;
    const saved = q.id ? byId('quotes', q.id) : null;
    const st = saved ? quoteStatus(saved) : 'new';
    const calcs = quoteCalcs(q);
    const oi = Math.min(num(UI('q.opt', 0)), q.options.length - 1);
    const o = q.options[oi];
    const locked = !!(saved && saved.invoiceId);
    const leadOpts = [['', '— Create a new lead from this client —'], ...D('leads').slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((l) => [l.id, l.name + (l.customer ? ' (customer)' : '')])];
    const acts = isNew ? `${btn('Polish text', 'q-polish', { icon: 'sparkles' })}${btn('Create quote', 'q-save', { cls: 'btn-primary', icon: 'check' })}`
      : `${S.emailEnabled ? btn('Email client', 'q-email', { icon: 'mail' }) : ''}${btn('PDF', 'q-pdf', { icon: 'download' })}${btn('Duplicate', 'q-dup', { icon: 'copyplus' })}${S.dirty ? btn('Save changes', 'q-save', { cls: 'btn-primary', icon: 'check' }) : btn('Saved', null, { disabled: true, icon: 'check' })}`;
    const flow = isNew ? '' : this.flow(saved, st);
    return back + `<div class="phead"><div style="min-width:0"><div class="eyebrow">${isNew ? 'New quote' : 'Quote · ' + esc(q.ref)}</div><h1 class="title" style="font-size:32px">${esc(isNew ? 'Draft new quote' : quoteTitle(q))}${exTag(q)}</h1><div class="row">${badge(QUOTE_STATUS, st)}<span class="num strong" style="color:var(--primary);font-size:16px" id="q-headtotal">${money(calcs[oi] ? calcs[oi].total : 0)}</span>${locked ? '<span class="badge c-grey">Locked · invoiced</span>' : ''}</div></div><div class="acts">${acts}</div></div>
      ${flow}
      <div class="split"><div class="stack">
        ${isNew ? this.aiBox() : ''}
        <div class="panel"><div class="panel-h"><h2 class="h2">Client</h2></div><div class="pad grid2">
          <div class="field" style="grid-column:1/-1"><label for="q-lead">Lead</label><select class="inp" id="q-lead" data-onchange="q-pick-lead">${leadOpts.map(([v, l]) => `<option value="${v}" ${q.leadId === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          ${this.inp('client.name', 'Client name *', q.client.name)}${this.inp('client.phone', 'Phone', q.client.phone, 'tel')}${this.inp('client.email', 'Email', q.client.email, 'email')}${this.inp('client.address', 'Address', q.client.address)}
          <div class="field"><label for="b-rep">Source rep</label><select class="inp" id="b-rep" data-bind="repId"><option value="">— Unattributed —</option>${repList().map((r) => `<option value="${r.id}" ${q.repId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="b-service">Service</label><select class="inp" id="b-service" data-bind="service"><option value="">—</option>${S.cfg.services.map((s) => `<option ${q.service === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        </div></div>
        <div class="panel"><div class="panel-h"><div><h2 class="h2">Project header</h2><div class="sub">These show on the PDF above the options.</div></div></div><div class="pad grid2">
          ${this.inp('title', 'Custom title', q.title, 'text', "e.g. 6'H Privacy Fence — 80ft (3 sides) + 2 gates", true)}
          ${this.inp('subtitle', 'Subtitle', q.subtitle, 'text', 'Short label, e.g. Carmen — front yard fence', true)}
          <div class="field" style="grid-column:1/-1"><label for="b-site">Site address</label><div class="row" style="flex-wrap:nowrap"><input class="inp" id="b-site" data-bind="siteAddress" value="${esc(q.siteAddress)}" placeholder="Project site address (defaults to client address)"><button class="btn btn-sm" data-act="q-useaddr">Use client address</button></div></div>
          <div class="field" style="grid-column:1/-1"><label for="b-desc">Description</label><textarea class="inp" id="b-desc" data-bind="description" rows="3" placeholder="Paragraph shown above the options on the PDF…">${esc(q.description)}</textarea></div>
        </div></div>
        <div class="panel"><div class="panel-h"><div><h2 class="h2">Options</h2><div class="sub">Up to 5 options, auto-labelled A–E. The client picks one (or several).</div></div><div class="opt-tabs">${q.options.map((x, i) => `<button class="${i === oi ? 'on' : ''}" data-act="ui" data-k="q.opt" data-v="${i}">${'ABCDE'[i]}${x.accepted ? ' ✓' : ''}</button>`).join('')}${q.options.length < 5 ? `<button data-act="q-addopt" title="Add option">${icon('plus')}</button>` : ''}</div></div>
          <div class="pad stack">
            <div class="grid2">${this.inp(`options.${oi}.title`, `Option ${'ABCDE'[oi]} title`, o.title, 'text', "e.g. 4x4 6'H full privacy PT fence @ $55/ft", true)}
            <div class="field" style="grid-column:1/-1"><label for="b-odesc">Option description (optional)</label><textarea class="inp" id="b-odesc" data-bind="options.${oi}.description" rows="2" placeholder="Short paragraph above the line items on the PDF…">${esc(o.description)}</textarea></div>
            <div class="field"><label for="b-tax">Tax type</label><select class="inp" id="b-tax" data-bind="options.${oi}.taxType"><option value="tax" ${o.taxType !== 'none' ? 'selected' : ''}>${esc(S.cfg.taxLabel)} ${num(S.cfg.taxRate)}%</option><option value="none" ${o.taxType === 'none' ? 'selected' : ''}>No tax</option></select></div></div>
            <div class="tablewrap"><table class="lines"><thead><tr><th style="min-width:240px">Line items</th><th style="width:80px">Qty</th><th style="width:90px">Unit</th><th style="width:110px">Rate</th><th style="width:70px" title="Show as included, no charge">Incl.</th><th style="width:110px;text-align:right">Amount</th><th style="width:40px"></th></tr></thead><tbody>
              ${o.items.map((it, j) => `<tr><td><textarea class="inp" rows="${Math.max(1, Math.ceil(String(it.description || '').length / 38))}" style="min-height:36px;padding:7px 10px" data-bind="options.${oi}.items.${j}.description" placeholder="e.g. RIGHT SIDE 20FT — SUPPLY & INSTALL" aria-label="Description">${esc(it.description)}</textarea></td>
                <td><input class="inp num" data-num data-bind="options.${oi}.items.${j}.qty" value="${esc(it.qty)}" inputmode="decimal" aria-label="Quantity"></td>
                <td><input class="inp" data-bind="options.${oi}.items.${j}.unit" value="${esc(it.unit)}" placeholder="ft / ea / sqft" aria-label="Unit"></td>
                <td><input class="inp num" data-num data-bind="options.${oi}.items.${j}.rate" value="${esc(it.rate)}" inputmode="decimal" aria-label="Rate"></td>
                <td style="text-align:center;padding-top:14px"><input type="checkbox" class="check" data-bind="options.${oi}.items.${j}.included" ${it.included ? 'checked' : ''} aria-label="Mark as included"></td>
                <td class="amt" id="amt-${oi}-${j}">${it.included ? 'Included' : money(num(it.qty) * num(it.rate))}</td>
                <td><button class="iconbtn" style="width:32px;height:32px;margin-top:2px" data-act="q-delitem" data-i="${j}" aria-label="Remove line">${icon('x')}</button></td></tr>`).join('')}
            </tbody></table></div>
            <div class="row between"><div class="row">${btn('Add line item', 'q-additem', { cls: 'btn-sm', icon: 'plus' })}${q.options.length > 1 ? btn('Remove option', 'q-delopt', { cls: 'btn-sm btn-danger', icon: 'trash' }) : ''}</div></div>
            <div class="totals" id="q-opttotals">${this.totalsHTML(calcs[oi], o)}</div>
          </div></div>
        <div class="panel"><div class="panel-h"><div><h2 class="h2">Discount</h2><div class="sub">One discount per quote: flat dollars or percent, applied before or after tax.</div></div></div><div class="pad grid4">
          <div class="field"><label for="b-dt">Type</label><select class="inp" id="b-dt" data-bind="discount.type"><option value="none" ${q.discount.type === 'none' ? 'selected' : ''}>None</option><option value="flat" ${q.discount.type === 'flat' ? 'selected' : ''}>Amount ($)</option><option value="percent" ${q.discount.type === 'percent' ? 'selected' : ''}>Percent (%)</option></select></div>
          <div class="field"><label for="b-dv">Value</label><input class="inp num" id="b-dv" data-num data-bind="discount.value" value="${esc(q.discount.value)}" inputmode="decimal"></div>
          <div class="field"><label for="b-dl">Label</label><input class="inp" id="b-dl" data-bind="discount.label" value="${esc(q.discount.label)}" placeholder="Spring promo"></div>
          <div class="field"><label for="b-da">Applies</label><select class="inp" id="b-da" data-bind="discount.applies"><option value="pre" ${q.discount.applies !== 'post' ? 'selected' : ''}>Pre-tax</option><option value="post" ${q.discount.applies === 'post' ? 'selected' : ''}>Post-tax</option></select></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h2 class="h2">Warranty & terms</h2><label class="check"><input type="checkbox" data-bind="includeWarranty" ${q.includeWarranty ? 'checked' : ''}>Include in this quote</label></div><div class="pad grid2">
          <div class="field" style="grid-column:1/-1"><label for="b-terms">Payment schedule</label><textarea class="inp" id="b-terms" data-bind="terms" rows="2">${esc(q.terms)}</textarea></div>
          ${q.includeWarranty ? `<div class="field" style="grid-column:1/-1"><label for="b-war">Warranty</label><textarea class="inp" id="b-war" data-bind="warranty" rows="3">${esc(q.warranty)}</textarea></div>` : ''}
        </div></div>
        <div class="panel"><div class="panel-h"><h2 class="h2">Internal notes</h2><span class="xs muted">Not shown to the client</span></div><div class="pad"><textarea class="inp" data-bind="notes" rows="3" aria-label="Internal notes" placeholder="Access, pricing logic, supplier quotes…">${esc(q.notes)}</textarea></div></div>
        ${!isNew ? this.activityHTML(saved) : ''}
      </div>
      <div class="stack sticky">${this.snapshot(q, saved, st, calcs)}</div></div>`;
  },
  inp(path, label, val, type = 'text', ph = '', span = false) { const id = 'b-' + path.replace(/\./g, '-'); return `<div class="field" ${span ? 'style="grid-column:1/-1"' : ''}><label for="${id}">${esc(label)}</label><input class="inp" id="${id}" type="${type}" data-bind="${path}" value="${esc(val)}" placeholder="${esc(ph)}"></div>`; },
  totalsHTML(c, o) {
    if (!c) return '';
    return `<span class="t-l">Subtotal</span><span class="num">${money(c.sub)}</span>${c.discount ? `<span class="t-l">Discount</span><span class="num">−${money(c.discount)}</span>` : ''}<span class="t-l">${o.taxType === 'none' ? 'No tax' : esc(S.cfg.taxLabel) + ' ' + num(S.cfg.taxRate) + '%'}</span><span class="num">${money(c.tax)}</span><span class="t-l strong">Option ${'ABCDE'[S.draft.options.indexOf(o)]} total</span><span class="num grand">${money(c.total)}</span>`;
  },
  onBind(path) {
    const q = S.draft; if (!q) return;
    const oi = Math.min(num(UI('q.opt', 0)), q.options.length - 1);
    const m = path.match(/^options\.(\d+)\.items\.(\d+)\.(qty|rate)$/);
    if (m) { const it = q.options[+m[1]].items[+m[2]]; const cell = $(`#amt-${m[1]}-${m[2]}`); if (cell) cell.textContent = it.included ? 'Included' : money(num(it.qty) * num(it.rate)); }
    const c = quoteCalcs(q);
    const tb = $('#q-opttotals'); if (tb) tb.innerHTML = this.totalsHTML(c[oi], q.options[oi]);
    const ht = $('#q-headtotal'); if (ht) ht.textContent = money(c[oi] ? c[oi].total : 0);
    const sv = $('[data-act="q-save"]') ; if (!sv) { const b = $('.phead .acts .btn[disabled]'); if (b) { b.outerHTML = btn('Save changes', 'q-save', { cls: 'btn-primary', icon: 'check' }); } }
    $$('[data-snap-total]').forEach((el) => { const i = +el.dataset.snapTotal; el.textContent = money(c[i] ? c[i].total : 0); });
  },
  aiBox() {
    return `<div class="panel ai-box"><div class="panel-h"><div class="row"><span class="ai-ic">${icon('sparkles')}</span><div><div class="eyebrow accent">AI quote drafter</div><h3 class="h3">Draft from notes</h3></div></div></div><div class="pad stack">
      <textarea class="inp mono" id="ai-notes" rows="5" placeholder="Paste your meeting notes, voice transcript, or quick summary here.&#10;&#10;Example:&#10;Devendar 416-301-0968 pal_deven@yahoo.com, Brampton ON&#10;6ft privacy fence 80ft 3 sides, 2 gates, wants PT wood vs vinyl option"></textarea>
      <div class="row between"><span class="xs muted" id="ai-status">Paste enough for client + scope (≥20 chars). Claude drafts options and line items; you review every field.</span>${btn('Generate draft', 'q-ai', { cls: 'btn-primary btn-sm', icon: 'sparkles' })}</div></div></div>`;
  },
  flow(saved, st) {
    const steps = [];
    if (['new'].includes(st)) steps.push(btn('Mark as sent', 'q-sent', { cls: 'btn-primary btn-sm', icon: 'send' }));
    if (['pending', 'follow_up', 'expired', 'new'].includes(st)) steps.push(btn('Customer approved', 'q-approve', { cls: 'btn-sm', icon: 'check' }), btn('Mark lost', 'q-lost', { cls: 'btn-sm btn-danger' }));
    if (st === 'expired') steps.push(btn('Extend expiry', 'q-extend', { cls: 'btn-sm', icon: 'clock' }));
    if (['approved', 'scheduled', 'in_progress'].includes(st) && !saved.invoiceId) steps.push(btn('Convert to invoice', 'q-invoice', { cls: 'btn-primary btn-sm', icon: 'receipt' }));
    if (saved.invoiceId) steps.push(btn('Open invoice', null, { cls: 'btn-sm', go: 'invoice', param: saved.invoiceId, icon: 'receipt' }));
    if (saved.projectId) steps.push(btn('Open project', null, { cls: 'btn-sm', go: 'project', param: saved.projectId, icon: 'hardhat' }));
    if (st === 'lost') steps.push(btn('Re-open', 'q-reopen', { cls: 'btn-sm' }));
    const msg = { new: 'Quote not sent yet. Mark it sent once the client has it, and a follow-up is scheduled automatically.', pending: `Awaiting the client's decision. Expires ${fmtDate(saved.expiresAt)}.`, follow_up: 'In follow-up. Work it from the Follow-ups queue.', expired: `Expired on ${fmtDate(saved.expiresAt)}. Extend it or mark it lost.`, approved: 'Approved. Convert to an invoice to create the project and bill the deposit.', scheduled: 'Scheduled on the calendar.', in_progress: 'Work is under way.', paid: 'Paid in full. Nice work.', lost: 'Marked lost.' }[st] || '';
    return `<div class="panel pad row between" style="margin-bottom:20px"><div class="row" style="min-width:0;flex:1 1 300px"><span class="eyebrow">Next step</span><span class="small">${esc(msg)}</span></div><div class="row">${steps.join('')}</div></div>`;
  },
  snapshot(q, saved, st, calcs) {
    const exp = saved && saved.expiresAt;
    return `<div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Snapshot</div><dl class="kv">
      <dt>Status</dt><dd>${badge(QUOTE_STATUS, st)}</dd><dt>Validity</dt><dd>${num(q.validityDays) || 30} days</dd>${exp ? `<dt>Expires</dt><dd>${fmtDate(exp)}</dd>` : ''}
      ${saved ? `<dt>Created</dt><dd>${fmtDate(saved.createdAt)}</dd><dt>Updated</dt><dd>${ago(saved.updatedAt)}</dd>` : ''}
      <dt>Lead</dt><dd>${q.leadId ? `<button class="linkbtn" data-go="lead" data-param="${q.leadId}">Open lead →</button>` : 'New on save'}</dd></dl></div>
      <div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Option totals</div><dl class="kv">${q.options.map((o, i) => `<dt>${'ABCDE'[i]} · ${esc((o.title || 'Untitled').slice(0, 26))}${o.accepted ? ' ✓' : ''}</dt><dd class="num" data-snap-total="${i}">${money(calcs[i].total)}</dd>`).join('')}</dl></div>
      ${saved ? `<div class="panel pad"><div class="field"><label for="q-fu">Next follow-up</label><input class="inp" type="datetime-local" id="q-fu" value="${esc(saved.followUpAt || '')}" data-onchange="q-fu" data-id="${saved.id}"></div><div class="row" style="margin-top:12px">${btn('Delete quote', 'q-del', { cls: 'btn-sm btn-danger', icon: 'trash' })}</div></div>` : ''}`;
  },
  activityHTML(saved) {
    const a = [...((saved && saved.activity) || [])].reverse();
    return `<div class="panel"><div class="panel-h"><h2 class="h2">Activity</h2></div>${a.length ? `<div class="pad timeline">${a.slice(0, 20).map((x) => `<div class="tl"><div><div class="xs muted">${fmtDT(x.at)}</div><div class="small">${esc(x.text)}</div></div></div>`).join('')}</div>` : '<div class="mini-empty">No activity yet.</div>'}</div>`;
  }
};
const qd = () => S.draft;
const curOpt = () => Math.min(num(UI('q.opt', 0)), qd().options.length - 1);
ACT['q-additem'] = () => { qd().options[curOpt()].items.push(newItem()); S.dirty = true; render(); const rows = $$('.lines tbody tr'); const last = rows[rows.length - 1]; if (last) last.querySelector('textarea').focus(); };
ACT['q-delitem'] = (el) => { const o = qd().options[curOpt()]; o.items.splice(num(el.dataset.i), 1); if (!o.items.length) o.items.push(newItem()); S.dirty = true; render(); };
ACT['q-addopt'] = () => { const q = qd(); if (q.options.length >= 5) return; const base = q.options[curOpt()]; const o = newOption(); o.taxType = base.taxType; q.options.push(o); S.ui['q.opt'] = q.options.length - 1; S.dirty = true; render(); };
ACT['q-delopt'] = () => { const q = qd(); if (q.options.length < 2) return; q.options.splice(curOpt(), 1); S.ui['q.opt'] = 0; S.dirty = true; render(); };
ACT['q-useaddr'] = () => { qd().siteAddress = qd().client.address; S.dirty = true; render(); };
ACT['q-pick-lead'] = (el) => { const q = qd(); const l = byId('leads', el.value); q.leadId = el.value; if (l) { q.client = { name: l.name, phone: l.phone || '', email: l.email || '', address: l.address || '' }; q.repId = q.repId || l.repId || ''; q.service = q.service || l.service || ''; q.category = l.category || q.category; q.source = l.source || q.source; if (!q.siteAddress) q.siteAddress = l.address || ''; } S.dirty = true; render(); };
ACT['q-fu'] = async (el) => { await Store.update('quotes', el.dataset.id, { followUpAt: el.value || null, snoozed: false }); toast('Follow-up updated'); };

function cleanQuote(q) {
  const c = clone(q); delete c.__for; delete c.id;
  c.options = c.options.map((o) => ({ ...o, items: o.items.filter((it) => it.description || num(it.rate) || it.included).map((it) => ({ ...it, qty: num(it.qty), rate: num(it.rate) })) }));
  c.options.forEach((o) => { if (!o.items.length) o.items = [newItem()]; });
  c.discount = { ...c.discount, value: num(c.discount.value) };
  return c;
}
const qlog = (q, text) => [...(q.activity || []), { at: nowISO(), text, by: S.me.id }];
ACT['q-save'] = async () => {
  const q = qd();
  if (!q.client.name.trim()) { toast('Client name is required.', 'bad'); $('#b-client-name') && $('#b-client-name').focus(); return; }
  const body = cleanQuote(q);
  if (!q.id) {
    if (!body.leadId) {
      body.leadId = await Store.add('leads', { category: body.category, name: body.client.name, phone: body.client.phone, email: body.client.email, address: body.client.address, service: body.service, source: body.source || S.cfg.sources[0], status: 'quoted', repId: body.repId, notes: [], history: [], customer: false });
    } else { const l = byId('leads', body.leadId); if (l && (l.status || 'new') !== 'quoted' && !l.customer) await Store.update('leads', l.id, { status: 'quoted' }); }
    body.ref = nextNumber('quotes', 'ref', S.cfg.quotePrefix);
    body.activity = qlog(body, 'Quote created');
    const id = await Store.add('quotes', body);
    S.dirty = false; S.draft = null; toast(`Quote ${body.ref} created`); go('quote', id);
  } else {
    body.activity = qlog(body, 'Quote updated');
    await Store.set('quotes', q.id, body);
    S.dirty = false; S.draft = null; toast('Quote saved'); render();
  }
};
async function quotePatch(patch, text) {
  const q = byId('quotes', S.param); if (!q) return;
  if (S.dirty) { toast('Save your changes first.', 'bad'); throw Object.assign(new Error('unsaved'), { shown: true }); }
  await Store.update('quotes', q.id, { ...patch, activity: qlog(q, text) });
  S.draft = null;
}
ACT['q-sent'] = async () => { const q = byId('quotes', S.param); const f = new Date(); f.setDate(f.getDate() + (num(S.cfg.followUpDays) || 3)); f.setHours(10, 0, 0, 0); await quotePatch({ status: 'pending', sentAt: nowISO(), expiresAt: keyPlus(num(q.validityDays) || 30), followUpAt: localDT(f) }, 'Status changed: sent to client'); toast('Marked as sent. Follow-up scheduled.'); };
ACT['q-lost'] = async () => { await quotePatch({ status: 'lost', followUpAt: null }, 'Status changed: lost'); toast('Marked lost'); };
ACT['q-reopen'] = async () => { await quotePatch({ status: 'pending', expiresAt: keyPlus(num(S.cfg.quoteValidity) || 30) }, 'Re-opened'); toast('Quote re-opened'); };
ACT['q-extend'] = () => openModal({ title: 'Extend expiration', body: `<div class="chips">${[7, 14, 30].map((d) => `<button class="chip" data-ext="${d}">+${d} days</button>`).join('')}</div>${F.text('to', 'New expiration date', keyPlus(14), { type: 'date' })}`, foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="ext-ok">Extend</button>`, onMount: (m) => { $$('[data-ext]', m).forEach((b) => (b.onclick = () => { $('#f-to', m).value = keyPlus(+b.dataset.ext); })); $('#ext-ok', m).onclick = async () => { const to = $('#f-to', m).value; await quotePatch({ expiresAt: to, status: 'pending' }, `Expiration extended to ${fmtDate(to)}`); closeModal(); toast('Expiration extended'); }; } });
ACT['q-approve'] = () => {
  const q = byId('quotes', S.param); if (S.dirty) { toast('Save your changes first.', 'bad'); return; }
  const c = quoteCalcs(q);
  openModal({ title: 'Customer approval', body: `<p class="small muted" style="margin:0">Which option(s) did the customer accept?</p>${q.options.map((o, i) => `<label class="check panel pad" style="justify-content:space-between"><span><input type="checkbox" name="acc" data-multi="1" value="${i}" ${i === 0 || o.accepted ? 'checked' : ''}> <b>Option ${'ABCDE'[i]}</b> · ${esc(o.title || 'Untitled')}</span><span class="num strong">${money(c[i].total)}</span></label>`).join('')}`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="ap-ok">Mark approved</button>`,
    onMount: (m) => { $('#ap-ok', m).onclick = async () => { const acc = formData(m).acc || []; if (!acc.length) { toast('Pick at least one option.', 'bad'); return; } const options = q.options.map((o, i) => ({ ...o, accepted: acc.includes(String(i)) })); await quotePatch({ options, status: 'approved', approvedAt: nowISO(), followUpAt: null }, `Customer accepted option ${acc.map((i) => 'ABCDE'[i]).join(', ')}`); if (q.leadId) await Store.update('leads', q.leadId, { customer: true, status: 'quoted', followUpAt: null }); closeModal(); toast('Approved. The client is now a customer.'); }; } });
};
ACT['q-invoice'] = () => {
  const q = byId('quotes', S.param); const c = quoteCalcs(q);
  const pre = q.options.map((o, i) => (o.accepted ? i : -1)).filter((i) => i >= 0); if (!pre.length) pre.push(0);
  openModal({ title: 'Convert to invoice', body: `<p class="small muted" style="margin:0">Pick which option(s) to bill. The invoice snapshots line items, taxes and warranty, and a project is created for scheduling.</p>${q.options.map((o, i) => `<label class="check panel pad" style="justify-content:space-between"><span><input type="checkbox" name="bill" data-multi="1" value="${i}" ${pre.includes(i) ? 'checked' : ''}> <b>Option ${'ABCDE'[i]}</b> · ${esc(o.title || 'Untitled')}</span><span class="num strong">${money(c[i].total)}</span></label>`).join('')}<div class="grid2">${F.text('issue', 'Issue date', todayKey(), { type: 'date' })}${F.text('due', 'Due date', keyPlus(num(S.cfg.invoiceDueDays) || 14), { type: 'date' })}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="inv-ok">Create invoice & project</button>`,
    onMount: (m) => { $('#inv-ok', m).onclick = async (ev) => { ev.target.disabled = true; const f = formData(m); const bill = (f.bill || []).map(Number); if (!bill.length) { ev.target.disabled = false; toast('Pick at least one option.', 'bad'); return; } await createInvoiceFromQuote(q, bill, f.issue, f.due); closeModal(); }; } });
};
async function createInvoiceFromQuote(q, bill, issue, due) {
  const c = quoteCalcs(q);
  const lines = bill.map((i) => ({ label: 'Option ' + 'ABCDE'[i], title: q.options[i].title, description: q.options[i].description, taxType: q.options[i].taxType, items: q.options[i].items, sub: c[i].sub, discount: c[i].discount, tax: c[i].tax, total: c[i].total }));
  const inv = { number: nextNumber('invoices', 'number', S.cfg.invoicePrefix), quoteId: q.id, quoteRef: q.ref, leadId: q.leadId, repId: q.repId || '', client: q.client, siteAddress: q.siteAddress, title: quoteTitle(q), issueDate: issue || todayKey(), dueDate: due || keyPlus(14), lines, subtotal: round2(sum(lines, (l) => l.sub)), discount: round2(sum(lines, (l) => l.discount)), tax: round2(sum(lines, (l) => l.tax)), total: round2(sum(lines, (l) => l.total)), payments: [], terms: q.terms, warranty: q.includeWarranty ? q.warranty : '', void: false };
  const invId = await Store.add('invoices', inv);
  const projId = await Store.add('projects', { title: quoteTitle(q), client: q.client, siteAddress: q.siteAddress || q.client.address, description: q.description, status: 'pending', start: '', end: '', crew: [], labor: [], leadId: q.leadId, quoteId: q.id, invoiceId: invId, category: q.category, service: q.service, notes: '' });
  await Store.update('invoices', invId, { projectId: projId });
  await Store.update('quotes', q.id, { invoiceId: invId, projectId: projId, status: q.status === 'new' || q.status === 'pending' ? 'approved' : q.status, options: q.options.map((o, i) => ({ ...o, accepted: bill.includes(i) || o.accepted })), activity: qlog(q, `Converted to invoice ${inv.number}`) });
  if (q.leadId) await Store.update('leads', q.leadId, { customer: true });
  S.draft = null; toast(`Invoice ${inv.number} and project created`); go('invoice', invId);
}
ACT['q-dup'] = async () => { const q = byId('quotes', S.param); const body = cleanQuote(q); delete body.invoiceId; delete body.projectId; delete body.sentAt; delete body.expiresAt; delete body.approvedAt; delete body.example; body.status = 'new'; body.followUpAt = null; body.options = body.options.map((o) => ({ ...o, accepted: false })); body.ref = nextNumber('quotes', 'ref', S.cfg.quotePrefix); body.activity = [{ at: nowISO(), text: `Duplicated from ${q.ref}` }]; const id = await Store.add('quotes', body); toast(`Duplicated as ${body.ref}`); S.draft = null; go('quote', id); };
ACT['q-del'] = () => { const q = byId('quotes', S.param); if (q.invoiceId) { toast('This quote has an invoice. Void the invoice instead.', 'bad'); return; } confirmBox('Delete this quote?', `${q.ref} will be permanently removed.`, 'Delete quote', async () => { S.dirty = false; await Store.del('quotes', q.id); toast('Quote deleted'); go('quotes'); }); };
ACT['q-pdf'] = async () => { const q = S.dirty ? cleanQuote(qd()) : byId('quotes', S.param); await quotePDF(q); };

/* ---------- AI drafting (sample capability) ---------- */
ACT['q-ai'] = async (el) => {
  const notes = ($('#ai-notes').value || '').trim();
  const status = $('#ai-status');
  if (notes.length < 20) { toast('Paste a bit more: client and scope.', 'bad'); return; }
  const sample = await getSampler();
  if (!sample) { toast('The AI drafter isn\'t available in this view.', 'bad'); return; }
  const past = D('quotes').filter((q) => (q.options || []).some((o) => o.items && o.items.length)).slice(-6).map((q) => ({ title: q.title, options: q.options.map((o) => ({ title: o.title, items: o.items.map((i) => `${i.description} | ${i.qty} ${i.unit} @ ${i.rate}`) })) }));
  const prompt = `You draft construction quotes for ${S.cfg.name} (${S.cfg.tagline}). Services: ${S.cfg.services.join(', ')}.
Tax: ${S.cfg.taxLabel} ${S.cfg.taxRate}% is added separately; give pre-tax rates. Currency ${S.cfg.currency}.
${past.length ? 'Recent quotes for pricing reference (title, items as "description | qty unit @ rate"):\n' + JSON.stringify(past).slice(0, 6000) + '\n' : 'No past quotes yet: use typical current market rates for the region implied by the notes, and keep them realistic.\n'}
From the meeting notes below, reply with ONLY a JSON object of this shape:
{"client":{"name":"","phone":"","email":"","address":""},"service":"one of the services or empty","title":"short PDF title","subtitle":"","description":"1-2 sentence scope summary","options":[{"title":"","description":"","items":[{"description":"UPPERCASE SHORT LINE e.g. RIGHT SIDE 20FT — SUPPLY & INSTALL","qty":1,"unit":"ft|ea|sqft|lot","rate":0}]}]}
Give 1-3 options when the notes compare materials or scopes, otherwise 1. Leave unknown contact fields empty.

NOTES:
${notes}`;
  status.textContent = 'Drafting…'; el.disabled = true;
  try {
    const r = await sample.json(prompt, { modelTier: 'default' });
    if (!r || !Array.isArray(r.options)) throw new Error('bad shape');
    const q = qd();
    const cl = r.client || {};
    q.client = { name: cl.name || q.client.name, phone: cl.phone || q.client.phone, email: cl.email || q.client.email, address: cl.address || q.client.address };
    if (!q.siteAddress) q.siteAddress = q.client.address;
    if (r.service && S.cfg.services.includes(r.service)) q.service = r.service;
    q.title = r.title || q.title; q.subtitle = r.subtitle || q.subtitle; q.description = r.description || q.description;
    q.options = r.options.slice(0, 5).map((o) => ({ ...newOption(), title: String(o.title || ''), description: String(o.description || ''), items: (o.items || []).map((i) => ({ ...newItem(), description: String(i.description || ''), qty: num(i.qty) || 1, unit: String(i.unit || 'ea'), rate: num(i.rate) })) }));
    q.options.forEach((o) => { if (!o.items.length) o.items = [newItem()]; });
    q.aiDrafted = true; S.ui['q.opt'] = 0; S.dirty = true; render(); toast('Draft ready. Review every field before saving.');
  } catch (e) {
    console.error(e);
    status.textContent = e && e.code === 'not_granted' ? 'AI is turned off for this page.' : e && e.code === 'rate_limited' ? 'Too many requests. Try again in a minute.' : 'Couldn\'t draft from those notes. Add the client name and scope, then try again.';
  } finally { el.disabled = false; }
};
ACT['q-polish'] = async (el) => {
  const sample = await getSampler();
  if (!sample) { toast('The AI assistant isn\'t available in this view.', 'bad'); return; }
  const q = qd();
  const fields = { title: q.title, subtitle: q.subtitle, description: q.description, options: q.options.map((o) => ({ title: o.title, description: o.description })) };
  if (!fields.description && !fields.title && !fields.options.some((o) => o.title || o.description)) { toast('Add some text to the title, description or options first.', 'bad'); return; }
  el.disabled = true; toast('Polishing…');
  try {
    const r = await sample.json(`Polish this construction quote text for a homeowner: clear, confident, plain English, fix spelling, keep every fact, numbers and measurements unchanged, keep option titles short. Reply with ONLY JSON in the exact same shape.\n\n${JSON.stringify(fields)}`, { modelTier: 'quick' });
    if (r.title != null) q.title = String(r.title); if (r.subtitle != null) q.subtitle = String(r.subtitle); if (r.description != null) q.description = String(r.description);
    (r.options || []).forEach((o, i) => { if (q.options[i]) { if (o.title != null) q.options[i].title = String(o.title); if (o.description != null) q.options[i].description = String(o.description); } });
    S.dirty = true; render(); toast('Text polished. Review and save.');
  } catch (e) { toast('Couldn\'t polish the text right now.', 'bad'); } finally { el.disabled = false; }
};

/* ============ Invoices ============ */
V.invoices = {
  render() {
    return pageHead({ eyebrow: 'Invoices', title: 'Invoices', lede: 'Track unpaid balances, record payments, generate invoice PDFs.', acts: btn('Export CSV', 'inv-csv', { icon: 'download' }) + btn('New invoice', 'inv-new', { cls: 'btn-primary', icon: 'plus' }) })
      + `<div class="panel filters"><div class="frow">${searchBox('inv.q', 'Invoice ref, client, source quote…')}</div><div class="fcols"><div><div class="lbl">Status</div>${chips('inv.status', [['all', 'All'], ...INVOICE_STATUS], UI('inv.status', 'all'))}</div><div><div class="lbl">Overdue</div><div class="chips"><button class="chip ${UI('inv.overdue', false) ? 'on' : ''}" data-act="ui" data-k="inv.overdue" data-v="${!S.ui['inv.overdue']}">Overdue only</button></div></div></div></div><div id="results">${this.results()}</div>`;
  },
  rows() { const st = UI('inv.status', 'all'), q = S.ui['inv.q'], od = S.ui['inv.overdue']; return D('invoices').filter((i) => (st === 'all' || invStatus(i) === st) && (!od || invOverdueDays(i) > 0) && match(q, i.number, i.client && i.client.name, i.quoteRef, i.title)).sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)) || String(b.number).localeCompare(String(a.number))); },
  results() {
    if (!ready('invoices')) return `<div class="panel" style="margin-top:20px">${loadingRows()}</div>`;
    const rows = this.rows(); const pg = pager('inv', rows.length);
    if (!rows.length) return `<div class="count"><b>0</b> of <b>${D('invoices').length}</b> invoices</div><div class="panel">${emptyBox('receipt', 'No invoices match your filters', 'Convert an approved quote into an invoice to start billing.', btn('Go to quotes', null, { go: 'quotes', cls: 'btn-primary', icon: 'arrowR' }))}</div>`;
    return `<div class="count"><b>${rows.length}</b> invoices · <b>${money(sum(rows, invDue))}</b> outstanding</div><div class="panel tablewrap"><table class="t"><thead><tr><th>Invoice</th><th>Client</th><th>Sales rep</th><th class="r">Total</th><th class="r">Amount due</th><th>Status</th><th>Due</th><th>Source quote</th></tr></thead><tbody>
      ${pg.slice(rows).map((i) => { const od = invOverdueDays(i); return `<tr class="click" data-go="invoice" data-param="${i.id}" tabindex="0"><td class="mono strong">${esc(i.number)}${exTag(i)}</td><td><div class="cell-main">${esc((i.client && i.client.name) || '—')}</div><div class="cell-sub trunc" style="max-width:280px">${esc(i.title || '')}</div></td><td>${esc(pname(i.repId) || '—')}</td><td class="r num">${money(i.total)}</td><td class="r num strong">${money(invDue(i))}</td><td>${badge(INVOICE_STATUS, invStatus(i))}${od ? ` <span class="badge c-bad">${od}d late</span>` : ''}</td><td class="small">${fmtDate(i.dueDate)}</td><td class="mono small">${esc(i.quoteRef || '—')}</td></tr>`; }).join('')}</tbody></table></div>${pg.html}`;
  }
};
ACT['inv-new'] = () => openModal({ title: 'Create from a quote', body: `<div class="empty" style="padding:20px"><div class="ic">${icon('receipt')}</div><p>Every invoice is generated from an approved quote, so client info, options and tax are consistent. Open the quote you want to bill and use <b>Convert to invoice</b>.</p></div>`, foot: `<button class="btn" data-act="modal-close">Close</button><button class="btn btn-primary" data-go="quotes">${icon('arrowR')}Go to quotes</button>` });
ACT['inv-csv'] = () => saveFile(`invoices-${todayKey()}.csv`, csv([['Invoice', 'Client', 'Rep', 'Issued', 'Due', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Status', 'Quote'], ...V.invoices.rows().map((i) => [i.number, i.client && i.client.name, pname(i.repId), i.issueDate, i.dueDate, i.subtotal, i.tax, i.total, invPaid(i).toFixed(2), invDue(i).toFixed(2), invStatus(i), i.quoteRef])]));

function docHTML(kind, d) {
  const c = S.cfg;
  const lines = kind === 'quote' ? (d.options || []).map((o, i) => { const k = optCalc(o, d); return { label: 'Option ' + 'ABCDE'[i], title: o.title, description: o.description, items: o.items, ...k, accepted: o.accepted }; }) : d.lines || [];
  return `<div class="doc"><div class="dh"><div>${c.logo ? `<img class="dlogo" src="${esc(c.logo)}" alt="">` : `<h1>${esc(c.name)}</h1>`}<div class="muted small" style="margin-top:6px">${esc([c.address, c.phone, c.email, c.website].filter(Boolean).join(' · '))}</div></div>
    <div style="text-align:right"><div style="font-size:11px;letter-spacing:.2em;font-weight:800;color:var(--primary)">${kind === 'quote' ? 'QUOTE' : 'INVOICE'}</div><h1>${esc(kind === 'quote' ? d.ref || 'Draft' : d.number)}</h1><div class="muted small">${kind === 'quote' ? `Date ${fmtDate(d.sentAt || d.createdAt || todayKey())}${d.expiresAt ? ' · Valid until ' + fmtDate(d.expiresAt) : ''}` : `Issued ${fmtDate(d.issueDate)} · Due ${fmtDate(d.dueDate)}`}</div></div></div>
    <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><div class="muted" style="font-size:10px;letter-spacing:.14em;font-weight:800">PREPARED FOR</div><b>${esc(d.client && d.client.name)}</b><div class="muted small">${esc([d.client && d.client.phone, d.client && d.client.email].filter(Boolean).join(' · '))}</div><div class="muted small">${esc(d.client && d.client.address)}</div></div>${d.siteAddress ? `<div><div class="muted" style="font-size:10px;letter-spacing:.14em;font-weight:800">PROJECT SITE</div><div class="small">${esc(d.siteAddress)}</div></div>` : ''}</div>
    ${d.title ? `<h3 style="margin:18px 0 2px;font-size:16px">${esc(d.title)}</h3>` : ''}${d.subtitle ? `<div class="muted small">${esc(d.subtitle)}</div>` : ''}${d.description ? `<p class="small" style="white-space:pre-wrap">${esc(d.description)}</p>` : ''}
    ${lines.map((o) => `<div class="opt"><h3>${esc(o.label)}${o.title ? ' — ' + esc(o.title) : ''}${o.accepted ? ' ✓' : ''}</h3>${o.description ? `<div class="muted small">${esc(o.description)}</div>` : ''}<table><thead><tr><th>Description</th><th class="r">Qty</th><th>Unit</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${(o.items || []).map((it) => `<tr><td>${esc(it.description)}</td><td class="r">${esc(it.qty)}</td><td>${esc(it.unit)}</td><td class="r">${it.included ? '' : money(it.rate)}</td><td class="r">${it.included ? 'Included' : money(num(it.qty) * num(it.rate))}</td></tr>`).join('')}</tbody></table>
      <div style="display:grid;grid-template-columns:1fr auto;gap:4px 24px;max-width:300px;margin-left:auto" class="small"><span class="muted">Subtotal</span><span class="r">${money(o.sub)}</span>${o.discount ? `<span class="muted">Discount</span><span class="r">−${money(o.discount)}</span>` : ''}<span class="muted">${o.taxType === 'none' ? 'No tax' : esc(c.taxLabel) + ' ' + num(c.taxRate) + '%'}</span><span class="r">${money(o.tax)}</span><b>Total</b><b class="r">${money(o.total)}</b></div></div>`).join('')}
    ${kind === 'invoice' ? `<div style="display:grid;grid-template-columns:1fr auto;gap:4px 24px;max-width:300px;margin:18px 0 0 auto;border-top:2px solid #16181d;padding-top:10px"><b>Invoice total</b><b class="r">${money(d.total)}</b><span class="muted">Paid</span><span class="r">${money(invPaid(d))}</span><b>Balance due</b><b class="r">${money(invDue(d))}</b></div>` : ''}
    ${d.terms ? `<div style="margin-top:20px"><div class="muted" style="font-size:10px;letter-spacing:.14em;font-weight:800">PAYMENT SCHEDULE</div><div class="small" style="white-space:pre-wrap">${esc(d.terms)}</div></div>` : ''}
    ${(kind === 'quote' ? d.includeWarranty && d.warranty : d.warranty) ? `<div style="margin-top:14px"><div class="muted" style="font-size:10px;letter-spacing:.14em;font-weight:800">WARRANTY</div><div class="small" style="white-space:pre-wrap">${esc(d.warranty)}</div></div>` : ''}</div>`;
}

V.invoice = {
  render() {
    const back = `<button class="back" data-go="invoices">${icon('arrowL')}Back to invoices</button>`;
    const i = byId('invoices', S.param);
    if (!i) return back + `<div class="panel">${ready('invoices') ? emptyBox('receipt', 'Invoice not found', 'It may have been deleted.') : loadingRows()}</div>`;
    const st = invStatus(i), od = invOverdueDays(i), paid = invPaid(i);
    return back + `<div class="phead"><div style="min-width:0"><div class="eyebrow">Invoice · ${esc(i.quoteRef || '')}</div><h1 class="title mono" style="font-size:34px">${esc(i.number)}${exTag(i)}</h1><div class="row">${badge(INVOICE_STATUS, st)}${od ? `<span class="badge c-bad">${od} days overdue</span>` : ''}<span class="small muted">${esc(i.client && i.client.name)}</span></div></div>
      <div class="acts">${S.emailEnabled && !i.void ? btn('Email client', 'inv-email', { icon: 'mail' }) : ''}${btn('PDF', 'inv-pdf', { icon: 'download' })}${!i.void && st !== 'paid' ? btn('Record payment', 'inv-pay', { cls: 'btn-primary', icon: 'dollar' }) : ''}</div></div>
      <div class="split"><div class="stack">${docHTML('invoice', i)}</div>
      <div class="stack sticky"><div class="panel pad"><div class="eyebrow" style="margin-bottom:12px">Balance</div><dl class="kv"><dt>Subtotal</dt><dd class="num">${money(i.subtotal)}</dd><dt>${esc(S.cfg.taxLabel)}</dt><dd class="num">${money(i.tax)}</dd><dt>Total</dt><dd class="num">${money(i.total)}</dd><dt>Paid</dt><dd class="num" style="color:var(--ok)">${money(paid)}</dd><dt><b>Due</b></dt><dd class="num" style="font-size:18px;font-weight:800">${money(invDue(i))}</dd></dl></div>
        <div class="panel"><div class="panel-h"><h2 class="h2">Payments</h2></div>${(i.payments || []).length ? `<div class="list">${i.payments.map((p) => `<div class="li"><div class="grow"><div class="strong num">${money(p.amount)}</div><div class="xs muted">${fmtDate(p.date)} · ${esc(p.method)}${p.note ? ' · ' + esc(p.note) : ''}</div></div><button class="iconbtn" data-act="inv-delpay" data-pid="${p.id}" aria-label="Remove payment">${icon('trash')}</button></div>`).join('')}</div>` : '<div class="mini-empty">No payments recorded.</div>'}</div>
        <div class="panel pad"><dl class="kv"><dt>Issued</dt><dd>${fmtDate(i.issueDate)}</dd>${i.emailedAt ? `<dt>Emailed</dt><dd>${fmtDate(i.emailedAt)}</dd>` : ''}<dt>Due</dt><dd><input class="inp inp-sm" type="date" value="${esc(i.dueDate)}" data-onchange="inv-due" aria-label="Due date"></dd><dt>Rep</dt><dd>${esc(pname(i.repId) || '—')}</dd><dt>Project</dt><dd>${i.projectId ? `<button class="linkbtn" data-go="project" data-param="${i.projectId}">Open project →</button>` : '—'}</dd><dt>Quote</dt><dd>${i.quoteId ? `<button class="linkbtn" data-go="quote" data-param="${i.quoteId}">${esc(i.quoteRef)} →</button>` : '—'}</dd></dl>
          <div class="row" style="margin-top:14px">${i.void ? btn('Restore', 'inv-unvoid', { cls: 'btn-sm' }) : btn('Void invoice', 'inv-void', { cls: 'btn-sm btn-danger' })}</div></div></div></div>`;
  }
};
ACT['inv-due'] = async (el) => { await Store.update('invoices', S.param, { dueDate: el.value }); toast('Due date updated'); };
ACT['inv-pay'] = () => {
  const i = byId('invoices', S.param);
  openModal({ title: 'Record payment', body: `<div class="grid2">${F.text('amount', 'Amount', invDue(i).toFixed(2), { type: 'number', step: '0.01', min: 0 })}${F.text('date', 'Date', todayKey(), { type: 'date' })}${F.select('method', 'Method', PAY_METHODS, 'E-transfer')}${F.text('note', 'Reference / note', '', { ph: 'Deposit, cheque #…' })}</div><div class="chips">${[[0.4, 'Deposit 40%'], [0.5, '50%'], [1, 'Balance']].map(([f, l]) => `<button class="chip" data-frac="${f}">${l}</button>`).join('')}</div>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" id="pay-ok">Record payment</button>`,
    onMount: (m) => { $$('[data-frac]', m).forEach((b) => (b.onclick = () => { $('#f-amount', m).value = (b.dataset.frac === '1' ? invDue(i) : Math.min(invDue(i), num(i.total) * num(b.dataset.frac))).toFixed(2); })); $('#pay-ok', m).onclick = async () => { const f = formData(m); if (!(num(f.amount) > 0)) { toast('Enter an amount.', 'bad'); return; } const payments = [...(i.payments || []), { id: uid(), amount: round2(f.amount), date: f.date || todayKey(), method: f.method, note: f.note, by: S.me.id }]; await Store.update('invoices', i.id, { payments }); const after = { ...i, payments }; if (invStatus(after) === 'paid' && i.quoteId) await Store.update('quotes', i.quoteId, { status: 'paid' }); closeModal(); toast(invStatus(after) === 'paid' ? 'Paid in full' : 'Payment recorded'); }; } });
};
ACT['inv-delpay'] = (el) => confirmBox('Remove this payment?', 'The balance will go back up by this amount.', 'Remove', async () => { const i = byId('invoices', S.param); await Store.update('invoices', i.id, { payments: (i.payments || []).filter((p) => p.id !== el.dataset.pid) }); toast('Payment removed'); });
ACT['inv-void'] = () => confirmBox('Void this invoice?', 'It stays on file but no longer counts toward revenue or balances.', 'Void invoice', async () => { await Store.update('invoices', S.param, { void: true }); toast('Invoice voided'); });
ACT['inv-unvoid'] = async () => { await Store.update('invoices', S.param, { void: false }); toast('Invoice restored'); };
ACT['inv-pdf'] = async () => { await invoicePDF(byId('invoices', S.param)); };

/* ============ PDF (jsPDF, loaded on demand) ============ */
let jspdfP = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jspdfP) jspdfP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = () => res(window.jspdf); s.onerror = () => { jspdfP = null; rej(new Error('Couldn\'t load the PDF library. Check your connection.')); }; document.head.appendChild(s); });
  return jspdfP;
}
function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
async function buildPDF(kind, d) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const c = S.cfg, W = 612, M = 48; let y = M;
  const brand = hexRGB(/^#[0-9a-f]{6}$/i.test(c.brand) ? c.brand : DEFAULT_CFG.brand);
  const pm = (v) => (c.currency || '$') + num(v).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const need = (h) => { if (y + h > 792 - M) { doc.addPage(); y = M; } };
  const text = (t, x, yy, o = {}) => { doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size || 10); doc.setTextColor(...(o.color || [22, 24, 29])); doc.text(String(t ?? ''), x, yy, { align: o.align || 'left', maxWidth: o.max }); };
  const wrap = (t, w, size = 10) => { doc.setFontSize(size); return doc.splitTextToSize(String(t || ''), w); };
  if (c.logo) { try { const img = new Image(); img.src = c.logo; await img.decode(); const h = 46, w = Math.min(180, (img.width / img.height) * h); doc.addImage(c.logo, c.logo.includes('image/png') ? 'PNG' : 'JPEG', M, y, w, h); } catch { text(c.name, M, y + 20, { bold: true, size: 18 }); } } else text(c.name, M, y + 20, { bold: true, size: 18 });
  text(kind === 'quote' ? 'QUOTE' : 'INVOICE', W - M, y + 8, { align: 'right', bold: true, size: 9, color: brand });
  text(kind === 'quote' ? d.ref || 'DRAFT' : d.number, W - M, y + 28, { align: 'right', bold: true, size: 18 });
  text(kind === 'quote' ? `Date ${fmtDate(d.sentAt || d.createdAt || todayKey())}${d.expiresAt ? '  ·  Valid until ' + fmtDate(d.expiresAt) : ''}` : `Issued ${fmtDate(d.issueDate)}  ·  Due ${fmtDate(d.dueDate)}`, W - M, y + 44, { align: 'right', size: 9, color: [90, 94, 106] });
  y += 62; text([c.address, c.phone, c.email, c.website].filter(Boolean).join('  ·  '), M, y, { size: 8.5, color: [90, 94, 106] });
  y += 10; doc.setDrawColor(...brand); doc.setLineWidth(2.5); doc.line(M, y, W - M, y); y += 22;
  text('PREPARED FOR', M, y, { bold: true, size: 7.5, color: [90, 94, 106] }); if (d.siteAddress) text('PROJECT SITE', W / 2 + 20, y, { bold: true, size: 7.5, color: [90, 94, 106] });
  y += 13; text(d.client && d.client.name, M, y, { bold: true, size: 11 }); if (d.siteAddress) wrap(d.siteAddress, 230).forEach((l, i) => text(l, W / 2 + 20, y + i * 12));
  y += 13; text([d.client && d.client.phone, d.client && d.client.email].filter(Boolean).join('  ·  '), M, y, { size: 9 }); y += 12; text(d.client && d.client.address, M, y, { size: 9 }); y += 22;
  if (d.title) { wrap(d.title, W - 2 * M, 13).forEach((l) => { need(16); text(l, M, y, { bold: true, size: 13 }); y += 16; }); }
  if (d.subtitle) { text(d.subtitle, M, y, { size: 9.5, color: [90, 94, 106] }); y += 14; }
  if (d.description) { wrap(d.description, W - 2 * M, 9.5).forEach((l) => { need(13); text(l, M, y, { size: 9.5 }); y += 13; }); y += 6; }
  const lines = kind === 'quote' ? (d.options || []).map((o, i) => ({ label: 'Option ' + 'ABCDE'[i], ...o, ...optCalc(o, d) })) : d.lines || [];
  const cols = [M, 330, 385, 440, W - M];
  lines.forEach((o) => {
    need(60); y += 8; text(`${o.label}${o.title ? ' — ' + o.title : ''}${o.accepted && kind === 'quote' ? '  (accepted)' : ''}`, M, y, { bold: true, size: 11, max: W - 2 * M }); y += 14;
    if (o.description) { wrap(o.description, W - 2 * M, 9).forEach((l) => { need(12); text(l, M, y, { size: 9, color: [90, 94, 106] }); y += 12; }); }
    doc.setFillColor(237, 238, 242); doc.rect(M, y, W - 2 * M, 18, 'F');
    [['DESCRIPTION', cols[0] + 6, 'left'], ['QTY', cols[2] - 6, 'right'], ['UNIT', cols[2] + 6, 'left'], ['RATE', cols[3] + 50, 'right'], ['AMOUNT', cols[4] - 6, 'right']].forEach(([t, x, a]) => text(t, x, y + 12, { bold: true, size: 7.5, align: a, color: [90, 94, 106] }));
    y += 18;
    (o.items || []).forEach((it) => { const dl = wrap(it.description, 270, 9); const h = Math.max(16, dl.length * 11 + 6); need(h); dl.forEach((l, k) => text(l, cols[0] + 6, y + 12 + k * 11, { size: 9 })); text(it.qty, cols[2] - 6, y + 12, { size: 9, align: 'right' }); text(it.unit, cols[2] + 6, y + 12, { size: 9 }); text(it.included ? '' : pm(it.rate), cols[3] + 50, y + 12, { size: 9, align: 'right' }); text(it.included ? 'Included' : pm(num(it.qty) * num(it.rate)), cols[4] - 6, y + 12, { size: 9, align: 'right' }); y += h; doc.setDrawColor(230, 232, 236); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); });
    y += 6; const tl = [['Subtotal', pm(o.sub)]]; if (o.discount) tl.push(['Discount', '-' + pm(o.discount)]); tl.push([o.taxType === 'none' ? 'No tax' : `${c.taxLabel} ${num(c.taxRate)}%`, pm(o.tax)]); tl.push(['Total', pm(o.total)]);
    tl.forEach(([a, b], k) => { need(14); const last = k === tl.length - 1; text(a, 430, y + 10, { size: last ? 10.5 : 9, bold: last, color: last ? [22, 24, 29] : [90, 94, 106] }); text(b, W - M - 6, y + 10, { size: last ? 10.5 : 9, bold: last, align: 'right' }); y += 14; });
    y += 6;
  });
  if (kind === 'invoice') { need(56); doc.setDrawColor(22, 24, 29); doc.setLineWidth(1.2); doc.line(400, y, W - M, y); y += 14; [['Invoice total', pm(d.total), true], ['Paid', pm(invPaid(d)), false], ['Balance due', pm(invDue(d)), true]].forEach(([a, b, bold]) => { text(a, 410, y, { bold, size: 10 }); text(b, W - M - 6, y, { bold, size: 10, align: 'right' }); y += 15; }); }
  const block = (title, body) => { if (!body) return; need(40); y += 10; text(title, M, y, { bold: true, size: 7.5, color: [90, 94, 106] }); y += 12; wrap(body, W - 2 * M, 9).forEach((l) => { need(12); text(l, M, y, { size: 9 }); y += 12; }); };
  block('PAYMENT SCHEDULE', d.terms);
  block('WARRANTY', kind === 'quote' ? (d.includeWarranty ? d.warranty : '') : d.warranty);
  if (kind === 'quote') { need(60); y += 24; doc.setDrawColor(150, 150, 160); doc.setLineWidth(0.6); doc.line(M, y, M + 220, y); doc.line(W - M - 160, y, W - M, y); text('Customer signature', M, y + 12, { size: 8, color: [90, 94, 106] }); text('Date', W - M - 160, y + 12, { size: 8, color: [90, 94, 106] }); }
  const pages = doc.getNumberOfPages(); for (let p = 1; p <= pages; p++) { doc.setPage(p); text(`${c.name} · ${kind === 'quote' ? d.ref || 'Draft' : d.number} · Page ${p} of ${pages}`, W / 2, 792 - 24, { size: 7.5, align: 'center', color: [140, 144, 154] }); }
  return doc.output('blob');
}
async function quotePDF(q) { toast('Building PDF…'); const blob = await buildPDF('quote', q); await saveFile(`${q.ref || 'quote'}-${String((q.client && q.client.name) || '').replace(/[^\w]+/g, '-')}.pdf`, blob); }
async function invoicePDF(i) { toast('Building PDF…'); const blob = await buildPDF('invoice', i); await saveFile(`${i.number}-${String((i.client && i.client.name) || '').replace(/[^\w]+/g, '-')}.pdf`, blob); }
