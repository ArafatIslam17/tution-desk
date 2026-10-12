/* ================= Student form ================= */
import { currentFee, currentSlots, saveStudent, slotConflicts } from '../../lib/domain.js';
import { S } from '../../lib/state.js';
import { $, $$, AVCOLORS, DAYS3, clone, curMonth, esc, fmtDur, isDate, isTime, monthOf, toMin, todayStr, uid } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { F, I, clearErrs, focusFirstErr, fv, modal, setErr, toast } from '../modal.js';
import { scheduleRender } from '../shell.js';
export function studentForm(id) {
  const s = id ? S.students[id] : null; const sl = s ? currentSlots(s) : [];
  const days = new Set(sl.map(x => Number(x.day)));
  const start = sl[0]?.start || '17:00'; const dur = sl[0]?.duration || 90;
  const ws = Number(S.profile.weekStart ?? 6); const order = [0, 1, 2, 3, 4, 5, 6].map(i => (ws + i) % 7);
  const body = `<div class="fgrid">
    ${F('name', 'Full name', I('name', s?.name, 'required maxlength="80" autocomplete="off"'), { req: true })}
    <div class="frow">${F('grade', 'Class / grade', I('grade', s?.grade, 'maxlength="40" placeholder="e.g. Class 8"'))}${F('school', 'School / college', I('school', s?.school, 'maxlength="80"'))}</div>
    ${F('subjects', 'Subjects', I('subjects', (s?.subjects || []).join(', '), 'maxlength="120" placeholder="Math, Science"'), { hint: 'Separate with commas. The first is used as the default for classes.' })}
    <div class="frow">${F('fee', 'Monthly fee', I('fee', s ? currentFee(s) : '', 'type="number" min="0" step="1" inputmode="numeric" required'), { req: true })}${F('status', 'Status', `<select id="f-status" name="status" class="input">${['active', 'paused', 'finished'].map(k => `<option value="${k}" ${(s?.status || 'active') === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select>`)}</div>
    ${F('startDate', 'Start date', I('startDate', s?.startDate || todayStr(), 'type="date" required'), { req: true, hint: 'Fees and classes are counted from this date.' })}
    <div class="fsec">Weekly schedule</div>
    <div class="field"><span class="flabel" id="days-l">Tuition days</span><div class="days" role="group" aria-labelledby="days-l">${order.map(d => `<label><input type="checkbox" name="day" value="${d}" ${days.has(d) ? 'checked' : ''}><span>${DAYS3[d]}</span></label>`).join('')}</div><span class="hint">Leave empty if you'll add classes one by one.</span></div>
    <div class="frow keep">${F('start', 'Start time', I('start', start, 'type="time"'))}${F('duration', 'Duration', `<select id="f-duration" name="duration" class="input">${[30, 45, 60, 75, 90, 105, 120, 150, 180].map(m => `<option value="${m}" ${Number(dur) === m ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')}</select>`)}</div>
    ${s ? F('applyFrom', 'Schedule changes apply from', I('applyFrom', todayStr(), 'type="date"'), { hint: 'Classes before this date keep the old schedule.' }) : ''}
    <div class="warnbox" id="stu-warn" role="status"></div>
    <div class="fsec">Guardian & location</div>
    <div class="frow">${F('guardianName', 'Guardian name', I('guardianName', s?.guardianName, 'maxlength="80"'))}${F('guardianPhone', 'Guardian phone', I('guardianPhone', s?.guardianPhone, 'type="tel" maxlength="30" inputmode="tel"'))}</div>
    ${F('location', 'Tuition location', I('location', s?.location, 'maxlength="100" placeholder="e.g. Student\'s home, Nasirabad"'))}
    ${F('notes', 'Notes', `<textarea id="f-notes" name="notes" class="input" maxlength="2000" placeholder="e.g. Weak in algebra. Needs extra practice.">${esc(s?.notes)}</textarea>`)}
  </div>`;
  const checkWarn = form => {
    const ds = $$('input[name=day]:checked', form).map(x => Number(x.value)); const st = fv(form, 'start');
    const w = ds.length && isTime(st) ? slotConflicts(ds.map(day => ({ day, start: st, duration: Number(fv(form, 'duration')) })), id) : [];
    $('#stu-warn').innerHTML = w.length ? `${ic('warn')}<div>This time overlaps with another scheduled event.<ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  };
  modal({
    title: s ? `Edit ${esc(s.name)}` : 'Add student', body, submit: s ? 'Save changes' : 'Add student', cls: 'stu', wide: true,
    onOpen: f => { f.addEventListener('input', () => checkWarn(f)); f.addEventListener('change', () => checkWarn(f)); checkWarn(f); },
    onSubmit: form => {
      clearErrs(form); let ok = true;
      const name = fv(form, 'name'); if (!name) ok = setErr(form, 'name', 'Enter the student\'s name.') && ok;
      const feeS = fv(form, 'fee'); const fee = Number(feeS);
      if (feeS === '' || !isFinite(fee) || fee < 0 || fee > 1e8) ok = setErr(form, 'fee', 'Enter a fee of 0 or more.') && ok;
      const sd = fv(form, 'startDate'); if (!isDate(sd)) ok = setErr(form, 'startDate', 'Choose a valid start date.') && ok;
      const ds = $$('input[name=day]:checked', form).map(x => Number(x.value)); const st = fv(form, 'start'); const du = Number(fv(form, 'duration'));
      if (ds.length && !isTime(st)) ok = setErr(form, 'start', 'Choose a start time for the schedule.') && ok;
      if (ds.length && isTime(st) && toMin(st) + du > 1439) ok = setErr(form, 'start', 'The class would run past midnight.') && ok;
      const af = s ? fv(form, 'applyFrom') : sd; if (s && !isDate(af)) ok = setErr(form, 'applyFrom', 'Choose a valid date.') && ok;
      if (!ok) { focusFirstErr(form); return false; }
      const slots = ds.sort((a, b) => a - b).map(day => ({ day, start: st, duration: du }));
      const rec = s ? clone(s) : { id: uid(), createdAt: new Date().toISOString(), color: AVCOLORS[Object.keys(S.students).length % AVCOLORS.length], noteLog: [], fees: [], schedules: [] };
      Object.assign(rec, { name, grade: fv(form, 'grade'), school: fv(form, 'school'), subjects: fv(form, 'subjects').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12), guardianName: fv(form, 'guardianName'), guardianPhone: fv(form, 'guardianPhone'), location: fv(form, 'location'), notes: fv(form, 'notes'), startDate: sd });
      const status = fv(form, 'status'); if (!s || s.status !== status) { rec.status = status; rec.statusSince = todayStr(); }
      // fee versions
      const cm = curMonth();
      if (!s) rec.fees = [{ from: monthOf(sd), amount: fee }];
      else if (currentFee(s) !== fee) { rec.fees = (rec.fees || []).filter(f => f.from < cm); rec.fees.push({ from: rec.fees.length ? cm : monthOf(sd), amount: fee }); }
      // schedule versions
      const same = JSON.stringify(currentSlots(rec)) === JSON.stringify(slots);
      if (!s) rec.schedules = slots.length ? [{ from: sd, slots }] : [];
      else if (!same) { const from = af <= sd ? sd : af; rec.schedules = (rec.schedules || []).filter(v => v.from < from); rec.schedules.push({ from, slots }); }
      if (rec.schedules.length && rec.schedules[0].from > sd && !s) rec.schedules[0].from = sd;
      S.students[rec.id] = rec; saveStudent(rec.id);
      toast(s ? 'Student updated' : `${name} added`);
      if (!s) location.hash = `#/student/${encodeURIComponent(rec.id)}`;
      scheduleRender();
    },
  });
}

