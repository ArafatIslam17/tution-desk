/* ================= Payment form ================= */
import { currentFee, feeFor, month, payState, saveMonth } from '../../lib/domain.js';
import { S } from '../../lib/state.js';
import { $, MONTHS, curMonth, esc, fmtMonth, isDate, isMonth, money, todayStr, uid } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { F, I, clearErrs, closeModal, focusFirstErr, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender, stuOptions } from '../shell.js';
export function paymentForm({ sid = '', m = '', p = null } = {}) {
  const mm = p?.forMonth || m || curMonth(); const s0 = S.students[p?.studentId || sid];
  const hint = (s, mon) => { if (!s || !isMonth(mon)) return ''; const q = payState(s, mon); return `Fee ${money(q.fee)}, paid ${money(q.paid)}, due <b>${money(q.due)}</b>`; };
  const suggested = p ? p.amount : (s0 ? payState(s0, mm).due || '' : '');
  const body = `<div class="fgrid">
    ${F('studentId', 'Student', `<select id="f-studentId" name="studentId" class="input" required>${stuOptions(p?.studentId || sid)}</select>`, { req: true })}
    <div class="frow">${F('amount', 'Amount', I('amount', suggested, 'type="number" min="1" step="1" inputmode="numeric" required'), { req: true })}${F('forMonth', 'For month', I('forMonth', mm, 'type="month" required'), { req: true })}</div>
    <div class="infobox" id="pay-hint">${hint(s0, mm) || 'Choose a student to see what is due.'}</div>
    ${F('date', 'Date received', I('date', p?.date || todayStr(), 'type="date" required'), { req: true })}
    ${F('note', 'Note', I('note', p?.note || '', 'maxlength="200" placeholder="e.g. bKash, cash"'))}</div>`;
  modal({
    title: p ? 'Edit payment' : 'Add payment', body, submit: p ? 'Save payment' : 'Add payment', cls: 'pay',
    footLeft: p ? `<button type="button" class="btn bad-t" data-del-pay>${ic('trash')}Delete</button>` : '',
    onOpen: f => {
      const upd = () => { const s = S.students[fv(f, 'studentId')]; $('#pay-hint').innerHTML = hint(s, fv(f, 'forMonth')) || 'Choose a student to see what is due.'; };
      f.elements.studentId.addEventListener('change', () => { upd(); const s = S.students[fv(f, 'studentId')]; if (s && !p && isMonth(fv(f, 'forMonth'))) f.elements.amount.value = payState(s, fv(f, 'forMonth')).due || ''; });
      f.elements.forMonth.addEventListener('change', upd);
      const del = f.parentElement.querySelector('[data-del-pay]'); if (del) del.onclick = () => { delete month(p.forMonth).payments[p.id]; saveMonth(p.forMonth); closeModal(); scheduleRender(); toast('Payment deleted', { undo: () => { month(p.forMonth).payments[p.id] = p; saveMonth(p.forMonth); scheduleRender(); } }); };
    },
    onSubmit: form => {
      clearErrs(form); let ok = true;
      const s = fv(form, 'studentId'); if (!S.students[s]) ok = setErr(form, 'studentId', 'Choose a student.') && ok;
      const amtS = fv(form, 'amount'); const amt = Number(amtS); if (amtS === '' || !isFinite(amt) || amt <= 0 || amt > 1e8) ok = setErr(form, 'amount', 'Enter an amount greater than zero.') && ok;
      const fm = fv(form, 'forMonth'); if (!isMonth(fm)) ok = setErr(form, 'forMonth', 'Choose the month this payment is for.') && ok;
      const d = fv(form, 'date'); if (!isDate(d)) ok = setErr(form, 'date', 'Choose a valid date.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      if (p && p.forMonth !== fm) { delete month(p.forMonth).payments[p.id]; saveMonth(p.forMonth); }
      const rec = { id: p?.id || uid(), studentId: s, amount: Math.round(amt * 100) / 100, forMonth: fm, date: d, note: fv(form, 'note') };
      month(fm).payments[rec.id] = rec; saveMonth(fm);
      const q = payState(S.students[s], fm);
      toast(q.due ? `Saved. ${money(q.due)} still due for ${MONTHS[Number(fm.slice(5)) - 1]}` : `Saved. ${MONTHS[Number(fm.slice(5)) - 1]} is fully paid`); scheduleRender();
    },
  });
}
export function feeForm(sid, m) {
  const s = S.students[sid]; const ov = S.months[m]?.fees?.[sid];
  modal({
    title: `Fee for ${esc(s.name)}, ${fmtMonth(m)}`, body: `<div class="fgrid">${F('fee', 'Fee this month', I('fee', feeFor(s, m), 'type="number" min="0" step="1" inputmode="numeric"'), { hint: `Usual fee is ${money(currentFee(s))}. Set 0 to waive this month (e.g. holidays).` })}</div>`,
    footLeft: ov != null ? `<button type="button" class="btn ghost" data-reset>Use usual fee</button>` : '',
    onOpen: f => { const r = f.parentElement.querySelector('[data-reset]'); if (r) r.onclick = () => { delete month(m).fees[sid]; saveMonth(m); closeModal(); scheduleRender(); }; },
    onSubmit: form => { const v = Number(fv(form, 'fee')); if (fv(form, 'fee') === '' || !isFinite(v) || v < 0) { setErr(form, 'fee', 'Enter 0 or more.'); return false; } month(m).fees[sid] = v; saveMonth(m); toast('Fee updated for this month'); scheduleRender(); },
  });
}

