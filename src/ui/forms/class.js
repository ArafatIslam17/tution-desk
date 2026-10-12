/* ================= Class form ================= */
import { D, avatar, classState, conflictsAt, currentSlots, durMin, findClass, plannedMin, putClass, removeTimeFor } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { $, addDays, clone, esc, fmtDate, fmtDur, fmtT, fromMin, isDate, isTime, relDay, toMin, todayStr, uid } from '../../lib/utils.js';
import { timeForm } from './time.js';
import { ic } from '../icons.js';
import { F, I, clearErrs, closeModal, focusFirstErr, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender, stuOptions } from '../shell.js';
/* Subject choices for a class: each of the student's subjects, all of them together, none, or a custom one. */
export function subjChoices(subjects, cur) {
  const opts = [...subjects]; if (subjects.length > 1) opts.push(subjects.join(' + '));
  const other = !!cur && !opts.includes(cur);
  const html = opts.map(x => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')
    + `<option value=""${!cur ? ' selected' : ''}>No subject</option><option value="__other" ${other ? 'selected' : ''}>Other…</option>`;
  return { html, other };
}
export function classForm({ c = null, sid = '', date = '' } = {}) {
  const s0 = S.students[c?.studentId || sid];
  const sl = s0 ? currentSlots(s0)[0] : null;
  const start = c?.start || sl?.start || '17:00'; const end = c?.end || fromMin(Math.min(toMin(start) + Number(sl?.duration || 60), 1439));
  const subjects = s0?.subjects || [];
  const body = `<div class="fgrid">
    ${F('studentId', 'Student', `<select id="f-studentId" name="studentId" class="input" ${c ? 'disabled' : ''} required>${stuOptions(c?.studentId || sid)}</select>`, { req: true })}
    <div class="frow3">${F('date', 'Date', I('date', c?.date || date || todayStr(), `type="date" required ${c?.recurring ? 'disabled' : ''}`), { req: true, hint: c?.recurring ? 'Use Reschedule to move a weekly class.' : '' })}${F('start', 'Start', I('start', start, 'type="time" required'), { req: true })}${F('end', 'End', I('end', end, 'type="time" required'), { req: true })}</div>
    <div class="frow">${(() => { const cur = c ? (c.subject || '') : (subjects[0] || ''); const sc = subjChoices(subjects, cur); return F('subject', 'Subject', `<select id="f-subject" name="subject" class="input">${sc.html}</select><input id="f-subjectOther" name="subjectOther" class="input" maxlength="60" placeholder="Type the subject" aria-label="Other subject" value="${sc.other ? esc(cur) : ''}" ${sc.other ? '' : 'hidden'} style="margin-top:6px">`); })()}${F('location', 'Location', I('location', c?.location ?? s0?.location ?? '', 'maxlength="100"'))}</div>
    ${F('status', 'Status', `<select id="f-status" name="status" class="input">${[['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<option value="${k}" ${(c?.status || 'scheduled') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    ${F('note', 'Class note', `<textarea id="f-note" name="note" class="input" maxlength="1000" placeholder="e.g. Today's topic: quadratic equations">${esc(c?.note)}</textarea>`)}
    <div class="durline" id="cls-dur" aria-live="polite"></div>
    <div class="warnbox" id="cls-warn" role="status"></div><div class="infobox" id="cls-info" role="status" hidden></div></div>`;
  const check = f => {
    const d = fv(f, 'date'), a = fv(f, 'start'), b = fv(f, 'end');
    const w = isDate(d) ? conflictsAt(d, a, b, { excludeId: c?.id }) : [];
    $('#cls-warn').innerHTML = w.length ? `${ic('warn')}<div>This time overlaps with another scheduled event.<ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const mins = durMin(a, b); const dl = $('#cls-dur'); const done = fv(f, 'status') === 'completed';
    dl.innerHTML = mins ? `${ic('clock')}<span>Teaching time <b>${fmtDur(mins)}</b>${done ? '' : ' <span class="faint">(counted once completed)</span>'}</span>` : (isTime(a) && isTime(b) ? `<span style="color:var(--bad)">End time must be later than start time.</span>` : '');
    const st = S.students[c ? c.studentId : fv(f, 'studentId')]; const info = $('#cls-info');
    const before = st && isDate(d) && st.startDate && d < st.startDate;
    info.hidden = !before;
    info.textContent = before ? `This is before ${st.name}'s start date (${fmtDate(st.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}). The class will be saved; edit the student's start date if fees should also count from earlier.` : '';
  };
  modal({
    title: c ? 'Edit class' : 'Add tuition class', body, submit: c ? 'Save class' : 'Add class',
    onOpen: f => {
      f.addEventListener('input', () => check(f)); f.addEventListener('change', () => check(f)); check(f);
      f.elements.subject.addEventListener('change', () => { const o = f.elements.subject.value === '__other'; f.elements.subjectOther.hidden = !o; if (o) f.elements.subjectOther.focus(); });
      f.elements.studentId.addEventListener('change', () => { check(f);
        const s = S.students[fv(f, 'studentId')]; if (!s) return; const q = currentSlots(s)[0];
        if (q) { f.elements.start.value = q.start; f.elements.end.value = fromMin(Math.min(toMin(q.start) + Number(q.duration), 1439)); }
        f.elements.subject.innerHTML = subjChoices(s.subjects || [], (s.subjects || [])[0] || '').html; f.elements.subjectOther.hidden = true; f.elements.location.value = s.location || ''; check(f);
      });
      f.elements.start.addEventListener('change', () => { const a = fv(f, 'start'); if (isTime(a) && !c) { const s = S.students[fv(f, 'studentId')]; const du = Number(currentSlots(s || {})[0]?.duration || 60); f.elements.end.value = fromMin(Math.min(toMin(a) + du, 1439)); check(f); } });
    },
    onSubmit: form => {
      clearErrs(form); let ok = true;
      const sid2 = c ? c.studentId : fv(form, 'studentId'); if (!S.students[sid2]) ok = setErr(form, 'studentId', 'Choose a student.') && ok;
      const d = c?.recurring ? c.date : fv(form, 'date'); if (!isDate(d)) ok = setErr(form, 'date', 'Choose a valid date.') && ok;
      const a = fv(form, 'start'), b = fv(form, 'end');
      if (!isTime(a)) ok = setErr(form, 'start', 'Enter the start time.') && ok;
      if (!isTime(b)) ok = setErr(form, 'end', 'Enter the end time.') && ok;
      else if (isTime(a) && toMin(b) <= toMin(a)) ok = setErr(form, 'end', 'End time must be later than start time.') && ok;
      if (fv(form, 'subject') === '__other' && !fv(form, 'subjectOther')) ok = setErr(form, 'subject', 'Type the subject, or pick one from the list.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      const status = fv(form, 'status');
      const rec = { ...(c || {}), id: c?.id || uid(), studentId: sid2, date: d, start: a, end: b, subject: fv(form, 'subject') === '__other' ? fv(form, 'subjectOther') : fv(form, 'subject'), location: fv(form, 'location'), note: fv(form, 'note'), status: c?.status === 'rescheduled' ? 'rescheduled' : status };
      if (!c) rec.createdAt = new Date().toISOString();
      if (status === 'cancelled') removeTimeFor(rec.id);
      putClass(rec, c && !c.virtual ? c.date : null); ui.flash = rec.id;
      toast(`${c ? 'Class saved' : 'Class added'} for ${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`, { action: { label: 'View', fn: () => { ui.cal.view = 'day'; ui.cal.date = d; location.hash = '#/calendar'; scheduleRender(); } } }); scheduleRender();
    },
  });
}

/* ================= Class detail ================= */
export function classDetail(id, date) {
  const c = findClass(id, date); if (!c || c.deleted) return toast('That class no longer exists.', { bad: true });
  const s = S.students[c.studentId]; const st = classState(c); const t = D().timeByClass[c.id];
  const btn = (act, icon, label, extra = '') => `<button type="button" class="btn ${extra}" data-act="${act}" data-id="${esc(c.id)}" data-date="${c.date}">${ic(icon)}${label}</button>`;
  const acts = [];
  if (c.status !== 'completed' && c.status !== 'rescheduled') acts.push(btn('complete', 'check', 'Mark completed', 'pri'));
  if (c.status !== 'cancelled' && c.status !== 'rescheduled') acts.push(btn('time-class', 'clock', c.status === 'completed' ? 'Adjust times' : 'Record actual times'));
  if (c.status === 'scheduled') acts.push(btn('reschedule', 'move', 'Reschedule'));
  if (c.status === 'scheduled' || c.status === 'completed') acts.push(btn('cancel-class', 'x', 'Cancel class'));
  if (c.status !== 'scheduled' && c.status !== 'rescheduled') acts.push(btn('reopen', 'move', 'Set back to scheduled'));
  acts.push(btn('class-note', 'note', c.note ? 'Edit note' : 'Add note'));
  acts.push(btn('edit-class', 'edit', 'Edit details'));
  acts.push(btn('delete-class', 'trash', 'Delete', 'bad-t'));
  const body = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">${avatar(s, 'lg')}<div><a href="#/student/${encodeURIComponent(s.id)}" data-close-nav style="font-family:var(--display);font-size:1.25rem;font-weight:650;text-decoration:none">${esc(s.name)}</a><div class="muted">${esc(relDay(c.date))}, ${fmtT(c.start)} – ${fmtT(c.end)}</div></div></div>
    <dl class="detail-grid"><dt>Status</dt><dd><span class="badge ${st.b}">${st.label}</span>${c.status === 'rescheduled' && c.rescheduledToDate ? ` <span class="muted">to ${fmtDate(c.rescheduledToDate)}</span>` : ''}${c.rescheduledFromDate ? ` <span class="muted">moved from ${fmtDate(c.rescheduledFromDate)}</span>` : ''}</dd>
    <dt>Time</dt><dd>${fmtT(c.start)} – ${fmtT(c.end)}</dd>
    <dt>Teaching time</dt><dd>${t ? `<b style="color:var(--tui-ink)">${fmtDur(t.minutes)}</b>` : `<span class="muted">${c.status === 'scheduled' ? `${fmtDur(plannedMin(c))} when completed` : 'Not counted'}</span>`}</dd>
    ${c.subject ? `<dt>Subject</dt><dd>${esc(c.subject)}</dd>` : ''}${c.location ? `<dt>Location</dt><dd>${esc(c.location)}</dd>` : ''}
    <dt>Type</dt><dd>${c.recurring ? 'Weekly schedule' : 'One-off class'}</dd>
    ${c.note ? `<dt>Note</dt><dd style="white-space:pre-wrap">${esc(c.note)}</dd>` : ''}</dl>
    <div class="act-grid">${acts.join('')}</div>`;
  modal({ title: 'Class', body, noFooter: true, onOpen: f => { const a = f.querySelector('[data-close-nav]'); a && a.addEventListener('click', closeModal); } });
}
export function setStatus(id, date, status) {
  const c = findClass(id, date); if (!c) return;
  const prev = clone(c);
  if (status === 'cancelled') removeTimeFor(c.id);
  putClass({ ...c, status }); ui.flash = c.id;
  closeModal(); scheduleRender();
  const s = S.students[c.studentId];
  if (status === 'completed') toast(`${s.name}: completed, ${fmtDur(durMin(c.start, c.end))} (${fmtT(c.start)}–${fmtT(c.end)})`, { action: { label: 'Adjust', fn: () => timeForm({ classId: c.id, date: c.date }) } });
  else toast(status === 'cancelled' ? 'Class cancelled' : 'Class set back to scheduled', { undo: status !== 'cancelled' ? () => { putClass(prev); scheduleRender(); } : null });
}

/* ================= Reschedule ================= */
export function rescheduleForm(id, date) {
  const c = findClass(id, date); if (!c) return;
  const body = `<div class="fgrid"><div class="infobox">Moving ${esc(S.students[c.studentId].name)}'s class on ${fmtDate(c.date)} at ${fmtT(c.start)}. The original stays in history as rescheduled.</div>
    <div class="frow3">${F('date', 'New date', I('date', addDays(c.date, 1), 'type="date" required'), { req: true })}${F('start', 'Start', I('start', c.start, 'type="time" required'), { req: true })}${F('end', 'End', I('end', c.end, 'type="time" required'), { req: true })}</div>
    ${F('note', 'Reason (optional)', I('note', '', 'maxlength="200"'))}<div class="warnbox" id="rs-warn" role="status"></div></div>`;
  const check = f => { const w = isDate(fv(f, 'date')) ? conflictsAt(fv(f, 'date'), fv(f, 'start'), fv(f, 'end'), { excludeId: c.id }) : []; $('#rs-warn').innerHTML = w.length ? `${ic('warn')}<div>This time overlaps with another scheduled event.<ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''; };
  modal({
    title: 'Reschedule class', body, submit: 'Reschedule', onOpen: f => { f.addEventListener('input', () => check(f)); check(f); },
    onSubmit: form => {
      clearErrs(form); let ok = true; const d = fv(form, 'date'), a = fv(form, 'start'), b = fv(form, 'end');
      if (!isDate(d)) ok = setErr(form, 'date', 'Choose a valid date.') && ok;
      if (!isTime(a)) ok = setErr(form, 'start', 'Enter the start time.') && ok;
      if (!isTime(b)) ok = setErr(form, 'end', 'Enter the end time.') && ok; else if (isTime(a) && toMin(b) <= toMin(a)) ok = setErr(form, 'end', 'End time must be later than start time.') && ok;
      if (ok && d === c.date && a === c.start) ok = setErr(form, 'date', 'Pick a different date or time.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      const nid = uid();
      putClass({ id: nid, studentId: c.studentId, date: d, start: a, end: b, subject: c.subject || '', location: c.location || '', status: 'scheduled', note: fv(form, 'note'), rescheduledFrom: c.id, rescheduledFromDate: c.date, createdAt: new Date().toISOString() });
      removeTimeFor(c.id);
      putClass({ ...c, status: 'rescheduled', rescheduledTo: nid, rescheduledToDate: d }); ui.flash = nid;
      toast(`Moved to ${fmtDate(d)}, ${fmtT(a)}`); scheduleRender();
    },
  });
}

