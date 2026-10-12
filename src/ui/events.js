/* ================= Event wiring ================= */
import { loadDemo, removeDemo } from '../lib/demo.js';
import { D, deleteClass, findClass, markRemindersRead, saveProfile, unreadReminders } from '../lib/domain.js';
import { S, ui } from '../lib/state.js';
import { Store } from '../lib/store.js';
import { $, addDays, addMonths, curMonth, esc, fmtDate, fmtDur, fmtT, monthFirst, monthOf, todayStr } from '../lib/utils.js';
import { changePasswordForm, signOut } from './auth.js';
import { exportBackup, importBackup, replaceAll } from './backup.js';
import { classDetail, classForm, rescheduleForm, setStatus } from './forms/class.js';
import { classNoteForm, noteForm } from './forms/notes.js';
import { feeForm, paymentForm } from './forms/payment.js';
import { studentForm } from './forms/student.js';
import { timeForm } from './forms/time.js';
import { uniForm } from './forms/university.js';
import { closeModal, confirmBox, dlg, fv, toast } from './modal.js';
import { moreSheet, openReminder, quickSheet, studentMenu } from './sheets.js';
import { removeAnimated, render, scheduleRender } from './shell.js';
export function handleAct(act, ds, el) {
  switch (act) {
    case 'quick': return quickSheet();
    case 'more-sheet': return moreSheet();
    case 'bell-close': ui.bellOpen = false; scheduleRender(); return requestAnimationFrame(() => requestAnimationFrame(() => $('[data-act=bell]')?.focus()));
    case 'bell': ui.bellOpen = !ui.bellOpen; scheduleRender(); return requestAnimationFrame(() => requestAnimationFrame(() => (ui.bellOpen ? $('#bellpop [data-act=rem-read-all]:not([disabled]), #bellpop [data-act=rem-open]') : $('[data-act=bell]'))?.focus()));
    case 'rem-read-all': { const u = unreadReminders(); markRemindersRead(u); scheduleRender(); return toast(u.length ? `Marked ${u.length} reminder${u.length > 1 ? 's' : ''} as read` : 'Nothing unread'); }
    case 'rem-open': return openReminder(ds.key);
    case 'new-student': return studentForm();
    case 'edit-student': return studentForm(ds.id);
    case 'student-menu': return studentMenu(ds.id);
    case 'new-class': if (!Object.keys(S.students).length) { toast('Add a student first.'); return studentForm(); } return classForm({ sid: ds.sid || '', date: ds.date || '' });
    case 'open-class': return classDetail(ds.id, ds.date);
    case 'edit-class': { const c = findClass(ds.id, ds.date); closeModal(); return c && classForm({ c }); }
    case 'complete': return setStatus(ds.id, ds.date, 'completed');
    case 'reopen': return setStatus(ds.id, ds.date, 'scheduled');
    case 'cancel-class': { const c = findClass(ds.id, ds.date); const t = D().timeByClass[ds.id]; if (t) return confirmBox({ title: 'Cancel this class?', text: `It's marked completed. Cancelling removes its ${fmtDur(t.minutes)} from your teaching time.`, ok: 'Cancel class', onOk: () => setStatus(ds.id, ds.date, 'cancelled') }); return c && setStatus(ds.id, ds.date, 'cancelled'); }
    case 'reschedule': return rescheduleForm(ds.id, ds.date);
    case 'delete-class': { const c = findClass(ds.id, ds.date); if (!c) return; return confirmBox({ title: 'Delete this class?', text: `${esc(S.students[c.studentId].name)}, ${fmtDate(c.date)} at ${fmtT(c.start)}. ${D().timeByClass[c.id] ? `Its ${fmtDur(D().timeByClass[c.id].minutes)} of teaching time will no longer be counted. ` : ''}${c.recurring ? 'Only this occurrence is removed; the weekly schedule stays.' : ''}`, ok: 'Delete class', onOk: () => removeAnimated(c.id, () => { deleteClass(c); toast('Class deleted'); scheduleRender(); }) }); }
    case 'class-note': return classNoteForm(ds.id, ds.date);
    case 'time-class': return timeForm({ classId: ds.id, date: ds.date });
    case 'new-time': if (!Object.keys(S.students).length) return toast('Add a student first.'); return timeForm({ sid: ds.sid || '' });
    case 'edit-time': { const t = Object.values(S.months[monthOf(ds.date)]?.times || {}).find(x => x.id === ds.id); return t && timeForm({ t, classId: t.classId, date: t.date }); }
    case 'new-payment': if (!Object.keys(S.students).length) return toast('Add a student first.'); return paymentForm({ sid: ds.sid || '', m: ds.month || '' });
    case 'edit-payment': { const p = S.months[ds.month]?.payments?.[ds.id]; return p && paymentForm({ p }); }
    case 'edit-fee': return feeForm(ds.sid, ds.month);
    case 'new-uni': return uniForm();
    case 'edit-uni': return uniForm(ds.id);
    case 'new-note': return noteForm(ds.sid);
    case 'edit-note': return noteForm(ds.sid, ds.id);
    case 'stu-filter': ui.stuF = ds.f; return scheduleRender();
    case 'cls-range': ui.cls.range = ds.r; return scheduleRender();
    case 'time-range': ui.time.range = ds.r; return scheduleRender();
    case 'pay-filter': ui.pay.f = ds.f; return scheduleRender();
    case 'pay-month': ui.pay.month = ds.d === '0' ? curMonth() : addMonths(ui.pay.month || curMonth(), Number(ds.d)); return scheduleRender();
    case 'cal-view': ui.cal.view = ds.v; return scheduleRender();
    case 'cal-nav': { const c = ui.cal; const n = Number(ds.d); if (!n) c.date = todayStr(); else if (c.view === 'month') c.date = monthFirst(addMonths(monthOf(c.date), n)); else c.date = addDays(c.date, n * (c.view === 'week' ? 7 : 1)); return scheduleRender(); }
    case 'cal-day': ui.cal.view = 'day'; ui.cal.date = ds.date; return scheduleRender();
    case 'export': return exportBackup();
    case 'import': { const inp = $('#import-file'); inp.value = ''; inp.onchange = () => importBackup(inp.files[0]); return inp.click(); }
    case 'sign-out': return signOut();
    case 'change-password': return changePasswordForm();
    case 'demo-load': return loadDemo();
    case 'demo-remove': return removeDemo();
    case 'wipe': return confirmBox({ title: 'Delete all data?', text: 'Every student, class, time record, payment and university class will be permanently deleted. This cannot be undone.', ok: 'Delete everything', onOk: async () => { await replaceAll({ profile: { ...S.profile }, students: {}, uni: {}, months: {} }); toast('All data deleted'); location.hash = '#/'; } });
  }
}
document.addEventListener('click', e => {
  if (ui.bellOpen && !e.target.closest('.bell')) { ui.bellOpen = false; scheduleRender(); }
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'A') { if (el.dataset.act === 'pay-goto') ui.pay.month = el.dataset.month; return; }
  if (el.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
  e.preventDefault(); e.stopPropagation();
  handleAct(el.dataset.act, el.dataset, el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.bellOpen && !dlg().open) { ui.bellOpen = false; scheduleRender(); requestAnimationFrame(() => requestAnimationFrame(() => $('[data-act=bell]')?.focus())); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][role=button],[data-act][role=gridcell],.cls[data-act],.li[data-act],.prow[data-act],.hrow[data-act]')) { e.preventDefault(); e.target.click(); }
});
export const inputMap = {
  'stu-q': v => ui.stuQ = v, 'h-sub': v => ui.prof.hSubject = v, 'h-st': v => ui.prof.hStatus = v,
  'cls-from': v => ui.cls.from = v, 'cls-to': v => ui.cls.to = v, 'cls-student': v => ui.cls.student = v, 'cls-status': v => ui.cls.status = v, 'cls-subject': v => ui.cls.subject = v,
  'time-from': v => ui.time.from = v, 'time-to': v => ui.time.to = v, 'time-student': v => ui.time.student = v,
};
document.addEventListener('input', e => { const k = e.target.dataset?.input; if (k && inputMap[k]) { inputMap[k](e.target.value); scheduleRender(); } });
document.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'prefs') return; e.preventDefault();
  const f = e.target; const dd = Math.min(28, Math.max(1, Number(fv(f, 'dueDay')) || 10));
  Object.assign(S.profile, { name: fv(f, 'name').slice(0, 60), currency: fv(f, 'currency').slice(0, 4) || '৳', weekStart: Number(fv(f, 'weekStart')), dueDay: dd, theme: fv(f, 'theme') });
  saveProfile(); toast('Preferences saved'); scheduleRender();
});
window.addEventListener('hashchange', () => { ui.bellOpen = false; closeModal(); render(); $('#main')?.focus({ preventScroll: true }); });
setInterval(() => { if (!dlg().open && Store.backend && !document.activeElement?.matches('input,select,textarea')) { S.v++; scheduleRender(); } }, 60000);
window.addEventListener('error', e => { console.error(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { console.error(e.reason); });

