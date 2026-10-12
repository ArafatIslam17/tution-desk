/* ================= Payments ================= */
import { avatar, monthSummary, outstanding, payState, paymentsFor, stuList } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { MONTHS, addMonths, curMonth, esc, fmtDate, fmtMonth, money } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { emptyState, payBadge, topbar } from '../shell.js';
export function vPayments() {
  const m = ui.pay.month || curMonth(); const f = ui.pay.f;
  const rows = stuList().map(s => ({ s, p: payState(s, m) })).filter(x => x.p.billable || x.p.paid);
  const shown = rows.filter(x => f === 'all' || x.p.status === f);
  const ms = monthSummary(m); const pct = ms.expected ? Math.min(100, ms.received / ms.expected * 100) : 0;
  const recs = paymentsFor(m).filter(p => S.students[p.studentId]).sort((a, b) => b.date.localeCompare(a.date));
  const earlier = stuList().map(s => ({ s, o: outstanding(s, addMonths(m, -1)) })).filter(x => x.o.total > 0);
  const chip = (k, l) => `<button class="chip" data-act="pay-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`;
  return topbar('Payments', 'Tuition fees and what is still owed', `<button class="btn pay" data-act="new-payment" data-month="${m}">${ic('plus')}Add payment</button>`)
    + `<div class="toolbar"><div class="navgrp" role="group" aria-label="Choose month"><button class="btn icon" data-act="pay-month" data-d="-1" aria-label="Previous month" title="Previous month">${ic('left')}</button><span class="period" aria-live="polite" style="text-align:center">${fmtMonth(m)}</span><button class="btn icon" data-act="pay-month" data-d="1" aria-label="Next month" title="Next month">${ic('right')}</button>${m !== curMonth() ? `<button class="btn sm" data-act="pay-month" data-d="0">This month</button>` : ''}</div>
      <div class="chips" role="group" aria-label="Filter by status">${chip('all', 'All')}${chip('paid', 'Paid')}${chip('partial', 'Partially paid')}${chip('due', 'Due')}</div></div>`
    + `<div class="grid-dash"><div class="stack"><section class="panel"><div class="panel-h"><h2>${fmtMonth(m)}</h2></div><div class="panel-b">
        <div class="money"><div><div class="k">Expected</div><div class="v">${money(ms.expected)}</div></div><div class="rcv"><div class="k">Received</div><div class="v">${money(ms.received)}</div></div><div class="due"><div class="k">Due</div><div class="v">${money(ms.due)}</div></div></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        ${shown.length ? `<div class="scroll-x" style="margin-top:12px"><table class="tbl stack"><thead><tr><th>Student</th><th class="r">Fee</th><th class="r">Paid</th><th class="r">Due</th><th>Status</th><th></th></tr></thead><tbody>${shown.map(({ s, p }) => `<tr><td><a href="#/student/${encodeURIComponent(s.id)}" style="display:flex;gap:8px;align-items:center;text-decoration:none;font-weight:650">${avatar(s)}${esc(s.name)}</a></td><td class="r num" data-l="Fee"><button class="btn sm ghost num" data-act="edit-fee" data-sid="${esc(s.id)}" data-month="${m}" title="Change the fee for this month only">${money(p.fee)}</button></td><td class="r num" data-l="Paid">${money(p.paid)}</td><td class="r num" data-l="Due">${p.due ? `<span class="amt due">${money(p.due)}</span>` : money(0)}</td><td>${payBadge(p.status)}</td><td class="r">${p.due ? `<button class="btn sm pay" data-act="new-payment" data-sid="${esc(s.id)}" data-month="${m}">Record</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState(rows.length ? 'search' : 'wallet', rows.length ? 'Nothing here' : 'No fees this month', rows.length ? 'No students match this filter.' : 'Students appear here once their start date is in or before this month.', '', { tone: 'pay' })}
      </div></section></div>
      <div class="stack"><section class="panel"><div class="panel-h"><h2>Received in ${MONTHS[Number(m.slice(5)) - 1]}</h2></div><div class="panel-b">${recs.length ? `<div class="list">${recs.map(p => `<div class="li" style="cursor:pointer" data-act="edit-payment" data-id="${esc(p.id)}" data-month="${m}">${avatar(S.students[p.studentId])}<div class="li-main"><div class="li-t">${esc(S.students[p.studentId]?.name)}</div><div class="li-s">Paid ${fmtDate(p.date)}${p.note ? ` · ${esc(p.note)}` : ''}</div></div><span class="amt">${money(p.amount)}</span></div>`).join('')}</div>` : '<div class="muted">No payments recorded for this month yet.</div>'}</div></section>
      <section class="panel"><div class="panel-h"><h2>Still due from earlier months</h2></div><div class="panel-b">${earlier.length ? `<div class="list">${earlier.map(x => `<div class="li">${avatar(x.s)}<div class="li-main"><div class="li-t">${esc(x.s.name)}</div><div class="li-s">${x.o.months.map(q => fmtMonth(q.m)).join(', ')}</div></div><span class="amt due">${money(x.o.total)}</span><button class="btn sm pay" data-act="new-payment" data-sid="${esc(x.s.id)}" data-month="${x.o.months[0].m}">Record</button></div>`).join('')}</div>` : '<div class="muted">All payments are up to date ✓</div>'}</div></section></div></div>`;
}

