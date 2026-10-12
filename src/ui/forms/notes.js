/* ================= Notes ================= */
import { findClass, putClass, saveStudent } from '../../lib/domain.js';
import { S } from '../../lib/state.js';
import { esc, fmtDate, isDate, todayStr, uid } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { F, I, closeModal, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender } from '../shell.js';
export function noteForm(sid, nid) {
  const s = S.students[sid]; const n = nid ? (s.noteLog || []).find(x => x.id === nid) : null;
  modal({
    title: n ? 'Edit note' : `Note for ${esc(s.name)}`, body: `<div class="fgrid">${F('text', 'Note', `<textarea id="f-text" name="text" class="input" maxlength="2000" rows="4" placeholder="e.g. Weak in algebra. Needs extra practice.">${esc(n?.text)}</textarea>`, { req: true })}${F('date', 'Date', I('date', n?.date || todayStr(), 'type="date"'))}</div>`,
    footLeft: n ? `<button type="button" class="btn bad-t" data-del>${ic('trash')}Delete</button>` : '',
    onOpen: f => { const d = f.parentElement.querySelector('[data-del]'); if (d) d.onclick = () => { const r = S.students[sid]; r.noteLog = (r.noteLog || []).filter(x => x.id !== nid); saveStudent(sid); closeModal(); scheduleRender(); }; },
    onSubmit: form => {
      const text = fv(form, 'text'); if (!text) { setErr(form, 'text', 'Write something first.'); return false; }
      const d = isDate(fv(form, 'date')) ? fv(form, 'date') : todayStr();
      const r = S.students[sid]; r.noteLog = (r.noteLog || []).filter(x => x.id !== nid); r.noteLog.push({ id: nid || uid(), date: d, text }); saveStudent(sid); toast('Note saved'); scheduleRender();
    },
  });
}
export function classNoteForm(id, date) {
  const c = findClass(id, date); if (!c) return;
  modal({
    title: 'Class note', body: `<div class="fgrid"><div class="infobox">${esc(S.students[c.studentId].name)}, ${fmtDate(c.date)}</div>${F('note', 'Note', `<textarea id="f-note" name="note" class="input" maxlength="1000" rows="4" placeholder="e.g. Today's topic: quadratic equations">${esc(c.note)}</textarea>`)}</div>`,
    onSubmit: form => { putClass({ ...c, note: fv(form, 'note') }); toast('Note saved'); scheduleRender(); },
  });
}

