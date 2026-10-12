/* ================= University form ================= */
import { activeStudents, currentSlots, saveUni } from '../../lib/domain.js';
import { S } from '../../lib/state.js';
import { $, DAYS, esc, fmtT, isTime, overlap, toMin, uid } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { F, I, clearErrs, closeModal, focusFirstErr, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender } from '../shell.js';
export function uniForm(id) {
  const u = id ? S.uni[id] : null; const ws = Number(S.profile.weekStart ?? 6);
  const body = `<div class="fgrid">
    ${F('name', 'Course name', I('name', u?.name, 'maxlength="80" required placeholder="e.g. Software Engineering"'), { req: true })}
    <div class="frow3">${F('day', 'Day', `<select id="f-day" name="day" class="input">${[0, 1, 2, 3, 4, 5, 6].map(i => (ws + i) % 7).map(d => `<option value="${d}" ${Number(u?.day ?? 0) === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select>`, { req: true })}${F('start', 'Start', I('start', u?.start || '10:00', 'type="time"'), { req: true })}${F('end', 'End', I('end', u?.end || '11:30', 'type="time"'), { req: true })}</div>
    <div class="frow">${F('code', 'Course code', I('code', u?.code, 'maxlength="20"'))}${F('room', 'Room', I('room', u?.room, 'maxlength="40"'))}</div>
    ${F('notes', 'Notes', I('notes', u?.notes, 'maxlength="200"'))}<div class="warnbox" id="uni-warn" role="status"></div></div>`;
  const check = f => { const a = fv(f, 'start'), b = fv(f, 'end'), d = Number(fv(f, 'day')); const w = []; if (isTime(a) && isTime(b) && toMin(b) > toMin(a)) for (const s of activeStudents()) for (const o of currentSlots(s)) if (Number(o.day) === d && overlap(toMin(a), toMin(b), toMin(o.start), toMin(o.start) + Number(o.duration))) w.push(`${s.name}'s tuition, ${fmtT(o.start)}`); $('#uni-warn').innerHTML = w.length ? `${ic('warn')}<div>This time overlaps with another scheduled event.<ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''; };
  modal({
    title: u ? 'Edit university class' : 'Add university class', body, submit: u ? 'Save' : 'Add', cls: 'uni',
    footLeft: u ? `<button type="button" class="btn bad-t" data-del-uni>${ic('trash')}Delete</button>` : '',
    onOpen: f => { f.addEventListener('input', () => check(f)); check(f); const del = f.parentElement.querySelector('[data-del-uni]'); if (del) del.onclick = () => { delete S.uni[id]; saveUni(id); closeModal(); scheduleRender(); toast('University class deleted', { undo: () => { S.uni[id] = u; saveUni(id); scheduleRender(); } }); }; },
    onSubmit: form => {
      clearErrs(form); let ok = true; const a = fv(form, 'start'), b = fv(form, 'end');
      if (!fv(form, 'name')) ok = setErr(form, 'name', 'Enter the course name.') && ok;
      if (!isTime(a)) ok = setErr(form, 'start', 'Enter the start time.') && ok;
      if (!isTime(b)) ok = setErr(form, 'end', 'Enter the end time.') && ok; else if (isTime(a) && toMin(b) <= toMin(a)) ok = setErr(form, 'end', 'End time must be later than start time.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      const rec = { ...(u || {}), id: id || uid(), day: Number(fv(form, 'day')), start: a, end: b, name: fv(form, 'name'), code: fv(form, 'code'), room: fv(form, 'room'), notes: fv(form, 'notes') };
      S.uni[rec.id] = rec; saveUni(rec.id); toast(u ? 'Saved' : 'University class added'); scheduleRender();
    },
  });
}

