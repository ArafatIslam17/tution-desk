/* ================= Teaching time form ================= */
import { deleteTime, durMin, findClass, isLive, occurrences, putClass, putTime } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { $, esc, fmtDate, fmtDur, fmtT, isDate, isTime, toMin, todayStr, uid } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { F, I, clearErrs, closeModal, focusFirstErr, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender, stuOptions } from '../shell.js';
export function timeForm({ classId = null, date = null, sid = '', t = null } = {}) {
  // Two cases: (1) a class — edit that class's actual start/end; its teaching time is End − Start.
  //            (2) an extra session without a class — a standalone record with its own start/end.
  const c = classId ? findClass(classId, date) : null;
  if (c && (c.status === 'cancelled' || c.status === 'rescheduled')) return toast('This class was not taught, so it has no teaching time.', { bad: true });
  const stuId = t?.studentId || c?.studentId || sid;
  const d0 = t?.date || c?.date || todayStr();
  const st = c ? c.start : t?.start || ''; const en = c ? c.end : t?.end || '';
  const classOpts = (s, d) => { const cs = s ? occurrences(d, d, { studentId: s }).filter(isLive) : []; return `<option value="">No class (extra session)</option>` + cs.map(x => `<option value="${esc(x.id)}">${fmtT(x.start)} class${x.status === 'completed' ? ' (completed)' : ''}</option>`).join(''); };
  const body = `<div class="fgrid">
    ${c ? `<div class="infobox">${esc(S.students[c.studentId].name)}, ${fmtDate(c.date)}${c.subject ? `, ${esc(c.subject)}` : ''}. Enter the times you actually taught; the duration is calculated.</div>` : `<div class="frow">${F('studentId', 'Student', `<select id="f-studentId" name="studentId" class="input" ${t ? 'disabled' : ''}>${stuOptions(stuId)}</select>`, { req: true })}${F('date', 'Date', I('date', d0, 'type="date"'), { req: true })}</div>
    ${t ? '' : F('classId', 'Class', `<select id="f-classId" name="classId" class="input">${classOpts(stuId, d0)}</select>`, { hint: 'Pick a class to set its times and mark it completed, or record an extra session.' })}`}
    <div class="frow keep">${F('tstart', 'Started at', I('tstart', st, 'type="time" required'), { req: true })}${F('tend', 'Finished at', I('tend', en, 'type="time" required'), { req: true })}</div>
    <div><span class="muted" style="font-size:.84rem;font-weight:600">Teaching time (End − Start)</span><div class="durpreview num" id="durprev" aria-live="polite">—</div></div>
    ${c ? '' : F('tnote', 'Note', I('tnote', t?.note || '', 'maxlength="200" placeholder="Optional"'))}</div>`;
  const calc = f => durMin(fv(f, 'tstart'), fv(f, 'tend'));
  modal({
    title: c ? (c.status === 'completed' ? 'Edit teaching time' : 'Record teaching time') : t ? 'Edit extra session' : 'Add teaching time', body, submit: 'Save time',
    footLeft: t ? `<button type="button" class="btn bad-t" data-del-time>${ic('trash')}Delete session</button>` : '',
    onOpen: f => {
      const upd = () => {
        const a2 = fv(f, 'tstart'), b2 = fv(f, 'tend'); const v = calc(f); const el = $('#durprev');
        el.textContent = v ? fmtDur(v) : (isTime(a2) && isTime(b2) ? 'End time must be later than start time' : '—');
        el.style.color = !v && isTime(a2) && isTime(b2) ? 'var(--bad)' : '';
      };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
      const refreshCls = () => { if (f.elements.classId) f.elements.classId.innerHTML = classOpts(fv(f, 'studentId'), fv(f, 'date')); };
      f.elements.studentId?.addEventListener('change', refreshCls); f.elements.date?.addEventListener('change', refreshCls);
      f.elements.classId?.addEventListener('change', () => { const x = findClass(fv(f, 'classId'), fv(f, 'date')); if (x) { f.elements.tstart.value = x.start; f.elements.tend.value = x.end; upd(); } });
      const del = f.parentElement.querySelector('[data-del-time]'); if (del) del.onclick = () => { deleteTime(t); closeModal(); toast('Extra session deleted', { undo: () => { putTime(t); scheduleRender(); } }); scheduleRender(); };
    },
    onSubmit: form => {
      clearErrs(form); let ok = true;
      const s = c ? c.studentId : t ? t.studentId : fv(form, 'studentId'); const d = c ? c.date : fv(form, 'date');
      if (!c && !S.students[s]) ok = setErr(form, 'studentId', 'Choose a student.') && ok;
      if (!c && !isDate(d)) ok = setErr(form, 'date', 'Choose a valid date.') && ok;
      const a2 = fv(form, 'tstart'), b2 = fv(form, 'tend');
      if (!isTime(a2)) ok = setErr(form, 'tstart', 'Enter the start time.') && ok;
      if (!isTime(b2)) ok = setErr(form, 'tend', 'Enter the end time.') && ok;
      else if (isTime(a2) && toMin(b2) <= toMin(a2)) ok = setErr(form, 'tend', 'End time must be later than start time.') && ok;
      const v = calc(form);
      if (v > 720) ok = setErr(form, 'tend', 'That is more than 12 hours. Check the times.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      const target = c || (!t && fv(form, 'classId') ? findClass(fv(form, 'classId'), d) : null);
      if (target) {
        putClass({ ...target, start: a2, end: b2, status: target.status === 'scheduled' ? 'completed' : target.status }); ui.flash = target.id;
        toast(`${fmtDur(v)} taught (${fmtT(a2)}–${fmtT(b2)})${target.status === 'scheduled' ? ', class marked completed' : ''}`);
      } else {
        putTime({ id: t?.id || uid(), studentId: s, classId: null, date: d, start: a2, end: b2, minutes: v, note: fv(form, 'tnote') }, t?.date);
        toast(`${fmtDur(v)} extra session recorded`);
      }
      scheduleRender();
    },
  });
}

