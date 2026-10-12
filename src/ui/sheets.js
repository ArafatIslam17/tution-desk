/* ================= Student menu / delete ================= */
import { markRemindersRead, reminders, saveMonth, saveStudent } from '../lib/domain.js';
import { S, ui } from '../lib/state.js';
import { $$, addDays, clone, esc, todayStr } from '../lib/utils.js';
import { handleAct } from './events.js';
import { classDetail } from './forms/class.js';
import { ic } from './icons.js';
import { closeModal, confirmBox, modal, toast } from './modal.js';
import { NAV, scheduleRender } from './shell.js';
export function studentMenu(id) {
  const s = S.students[id];
  const body = `<div class="act-grid" style="margin-top:0">
    ${s.status !== 'active' ? `<button type="button" class="btn" data-sm="active">${ic('check')}Mark active</button>` : `<button type="button" class="btn" data-sm="paused">${ic('clock')}Pause tuition</button>`}
    ${s.status !== 'finished' ? `<button type="button" class="btn" data-sm="finished">${ic('grad')}Mark finished (archive)</button>` : ''}
    <button type="button" class="btn bad-t" data-sm="delete">${ic('trash')}Delete permanently</button></div>
    <p class="muted" style="font-size:.86rem;margin-bottom:0">Paused and finished students keep their history and payments; no new classes are generated for them.</p>`;
  const f = modal({ title: esc(s.name), body, noFooter: true });
  $$('[data-sm]', f).forEach(b => b.onclick = () => {
    const k = b.dataset.sm;
    if (k === 'delete') return deleteStudent(id);
    const r = S.students[id]; const prev = clone(r); r.status = k; r.statusSince = todayStr(); saveStudent(id); closeModal(); scheduleRender();
    toast(`${r.name} is now ${k}`, { undo: () => { S.students[id] = prev; saveStudent(id); scheduleRender(); } });
  });
}
export function deleteStudent(id) {
  const s = S.students[id]; let n = 0;
  for (const m of Object.values(S.months)) for (const k of ['classes', 'payments', 'times']) n += Object.values(m[k] || {}).filter(x => x.studentId === id).length;
  confirmBox({
    title: `Delete ${esc(s.name)}?`, text: `This permanently deletes ${esc(s.name)} and ${n} related class, time and payment records. To keep their history, mark them <b>Finished</b> instead.`, ok: 'Delete student',
    onOk: () => {
      delete S.students[id]; saveStudent(id);
      for (const [mk, m] of Object.entries(S.months)) { let ch = false; for (const k of ['classes', 'payments', 'times']) for (const [rid, x] of Object.entries(m[k] || {})) if (x.studentId === id) { delete m[k][rid]; ch = true; } if (m.fees?.[id] != null) { delete m.fees[id]; ch = true; } if (ch) saveMonth(mk); }
      location.hash = '#/students'; toast('Student deleted'); scheduleRender();
    },
  });
}

/* ================= Quick add & more ================= */
export function quickSheet() {
  const qa = (act, icon, label, c) => `<button type="button" class="qa" data-q="${act}" style="--c:var(--${c});--c-soft:var(--${c}-soft)"><span class="ic">${ic(icon)}</span>${label}</button>`;
  const f = modal({ title: 'Quick add', noFooter: true, body: `<div class="sheet-grid">${qa('new-class', 'book', 'Tuition class', 'tui')}${qa('new-time', 'clock', 'Teaching time', 'tui')}${qa('new-payment', 'wallet', 'Payment', 'pay')}${qa('new-student', 'users', 'Student', 'stu')}${qa('new-uni', 'uni', 'University class', 'uni')}</div>` });
  $$('[data-q]', f).forEach(b => b.onclick = () => { closeModal(); handleAct(b.dataset.q, {}); });
}
export function moreSheet() {
  const f = modal({ title: 'More', noFooter: true, body: `<nav class="nav" style="display:grid;gap:4px">${NAV.filter(n => n && ['classes', 'time', 'university', 'settings'].includes(n[0])).map(n => `<a href="#/${n[0]}" data-sec="${n[3]}">${ic(n[1])}${n[2]}</a>`).join('')}</nav>` });
  $$('a', f).forEach(a => a.addEventListener('click', closeModal));
}
export function openReminder(key) {
  const x = reminders().find(r => r.key === key); ui.bellOpen = false;
  if (!x) return scheduleRender();
  markRemindersRead([x]);
  if (x.kind === 'class') { scheduleRender(); classDetail(x.c.id, x.c.date); }
  else if (x.kind === 'unmarked') { ui.cls = { ...ui.cls, range: 'custom', from: addDays(todayStr(), -14), to: todayStr(), status: 'miss' }; location.hash = '#/classes'; scheduleRender(); }
  else if (x.kind === 'tomorrow') { ui.cal.view = 'day'; ui.cal.date = addDays(todayStr(), 1); location.hash = '#/calendar'; scheduleRender(); }
  else { location.hash = '#/payments'; scheduleRender(); }
}

