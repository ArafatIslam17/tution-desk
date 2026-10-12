/* ================= Domain ================= */
import { S } from './state.js';
import { Store } from './store.js';
import { AVCOLORS, DAYS, addDays, addMonths, curMonth, dow, eachDay, esc, fmtDur, fmtMonth, fmtT, fromMin, isDate, isTime, money, monthFirst, monthLast, monthOf, monthsBetween, nowMin, overlap, toMin, todayStr } from './utils.js';
export function month(m) {
  if (!S.months[m]) S.months[m] = { classes: {}, payments: {}, times: {}, fees: {} };
  const mo = S.months[m]; mo.classes ||= {}; mo.payments ||= {}; mo.times ||= {}; mo.fees ||= {};
  return mo;
}
export const saveMonth = m => Store.save('months', m);
export const saveStudent = id => Store.save('students', id);
export const saveUni = id => Store.save('uni', id);
export const saveProfile = () => Store.save('app');
export const stuList = () => Object.values(S.students).sort((a, b) => a.name.localeCompare(b.name));
export const activeStudents = () => stuList().filter(s => s.status === 'active');
export const stuColor = s => s?.color || AVCOLORS[0];
export const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const avatar = (s, cls = '') => `<span class="av ${cls}" style="background:${esc(stuColor(s))}" aria-hidden="true">${esc(initials(s?.name))}</span>`;

export function slotsFor(s, date) {
  let slots = [];
  for (const v of s.schedules || []) if (v.from <= date) slots = v.slots || [];
  return slots;
}
export function currentSlots(s) { const v = (s.schedules || []).slice(-1)[0]; return v ? v.slots : []; }
/** Earliest date this student has anything recorded: their start date, or an earlier class / teaching-time record. */
export function historyStart(s) {
  let first = s.startDate || todayStr();
  for (const m of Object.keys(S.months)) {
    const mo = S.months[m];
    for (const c of Object.values(mo.classes || {})) if (c.studentId === s.id && !c.deleted && c.date < first) first = c.date;
    for (const x of Object.values(mo.times || {})) if (x.studentId === s.id && x.date < first) first = x.date;
  }
  return first;
}
export function teachingOn(s, date) {
  if (!s.startDate || date < s.startDate) return false;
  if (s.status === 'active') return true;
  return !!s.statusSince && date < s.statusSince;
}
export function feeFor(s, m) {
  const ov = S.months[m]?.fees?.[s.id];
  if (ov != null) return Number(ov);
  const f = s.fees || []; let a = f[0]?.amount || 0;
  for (const v of f) if (v.from <= m) a = v.amount;
  return Number(a) || 0;
}
export function currentFee(s) { return feeFor(s, curMonth()); }
export function billable(s, m) {
  if (!s.startDate || monthOf(s.startDate) > m) return false;
  if (s.status === 'active') return true;
  return !!s.statusSince && monthOf(s.statusSince) >= m;
}

/** Minutes between two HH:MM times on the same day; 0 if missing or not later. */
export const durMin = (a, b) => (isTime(a) && isTime(b) && toMin(b) > toMin(a) ? toMin(b) - toMin(a) : 0);
/** Teaching time of a class: a completed class counts End − Start; anything else counts nothing. */
export const classMinutes = c => (c && c.status === 'completed' && !c.deleted ? durMin(c.start, c.end) : 0);

/* Derived-data cache, rebuilt when state version changes.
   Teaching "sessions" = every completed class (time from its own start/end) + extra sessions recorded without a class. */
export let _dv = -1, _D = null;
export function D() {
  if (_dv === S.v && _D) return _D;
  const timeByClass = {}; const allTimes = [];
  for (const m in S.months) {
    const mo = S.months[m];
    for (const c of Object.values(mo.classes || {})) {
      if (!S.students[c.studentId]) continue;
      const minutes = classMinutes(c); if (!minutes) continue;
      const s = { id: 'c:' + c.id, classId: c.id, studentId: c.studentId, date: c.date, start: c.start, end: c.end, minutes, note: '' };
      allTimes.push(s); timeByClass[c.id] = s;
    }
    for (const t of Object.values(mo.times || {})) {
      if (!S.students[t.studentId] || t.classId) continue; // linked records are migrated into their class
      const minutes = t.start && t.end ? durMin(t.start, t.end) : Number(t.minutes) || 0;
      if (minutes > 0) allTimes.push({ ...t, minutes });
    }
  }
  _D = { timeByClass, allTimes }; _dv = S.v; return _D;
}

/** One-time upgrade: older versions kept teaching time in separate records linked to a class.
 *  Move each record's actual start/end onto its class (the class becomes the single source of truth). Idempotent. */
export function migrateLinkedTimes() {
  const changed = new Set(); const byId = {};
  for (const m in S.months) for (const c of Object.values(S.months[m].classes || {})) byId[c.id] = { m, c };
  for (const m in S.months) {
    const times = S.months[m].times || {};
    for (const [tid, t] of Object.entries(times)) {
      if (!t.classId) continue;
      const hit = byId[t.classId];
      if (hit && !hit.c.deleted) {
        const c = hit.c;
        if (isTime(t.start) && isTime(t.end) && toMin(t.end) > toMin(t.start)) { c.start = t.start; c.end = t.end; }
        else if (Number(t.minutes) > 0 && isTime(c.start)) c.end = fromMin(Math.min(toMin(c.start) + Number(t.minutes), 1439));
        if (c.status === 'scheduled') c.status = 'completed';
        changed.add(hit.m);
        delete times[tid];
      } else { t.classId = null; } // class gone: keep it as an extra session
      changed.add(m);
    }
  }
  changed.forEach(m => saveMonth(m));
  if (changed.size) S.v++;
  return changed.size;
}

/** All classes (stored + generated from recurring schedules) in [from, to]. */
export function occurrences(from, to, { studentId = null, includeDeleted = false } = {}) {
  const out = []; const seen = new Set();
  for (const m of monthsBetween(from, to)) {
    const mo = S.months[m]; if (!mo) continue;
    for (const c of Object.values(mo.classes || {})) {
      if (c.date < from || c.date > to) continue;
      if (studentId && c.studentId !== studentId) continue;
      seen.add(c.id);
      if (!S.students[c.studentId]) continue;
      if (c.deleted && !includeDeleted) continue;
      out.push(c);
    }
  }
  const studs = studentId ? [S.students[studentId]].filter(Boolean) : Object.values(S.students);
  for (const s of studs) {
    if (!s.schedules?.length || !s.startDate) continue;
    const a = from > s.startDate ? from : s.startDate;
    for (const date of eachDay(a, to)) {
      if (!teachingOn(s, date)) continue;
      const wd = dow(date);
      slotsFor(s, date).forEach((sl, i) => {
        if (Number(sl.day) !== wd) return;
        const id = `r_${s.id}_${date}_${i}`;
        if (seen.has(id)) return;
        out.push({ id, studentId: s.id, date, start: sl.start, end: fromMin(Math.min(toMin(sl.start) + Number(sl.duration || 60), 1439)), subject: (s.subjects || [])[0] || '', location: s.location || '', status: 'scheduled', recurring: true, virtual: true });
      });
    }
  }
  return out.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
}
export function findClass(id, date) { return occurrences(date, date, { includeDeleted: true }).find(c => c.id === id); }
export const plannedMin = c => Math.max(0, toMin(c.end) - toMin(c.start));
export const isLive = c => c.status !== 'cancelled' && c.status !== 'rescheduled' && !c.deleted;

export function classState(c) {
  if (c.status === 'completed') return { k: 'done', label: 'Completed', b: 'b-done' };
  if (c.status === 'cancelled') return { k: 'cancel', label: 'Cancelled', b: 'b-cancel' };
  if (c.status === 'rescheduled') return { k: 'resch', label: 'Rescheduled', b: 'b-resch' };
  const t = todayStr(), n = nowMin();
  if (c.date < t || (c.date === t && toMin(c.end) <= n)) return { k: 'miss', label: 'Not marked', b: 'b-miss' };
  if (c.date === t && toMin(c.start) <= n) return { k: 'now', label: 'In progress', b: 'b-now' };
  return { k: 'up', label: 'Upcoming', b: 'b-up' };
}

export function putClass(c, prevDate) {
  const rec = { ...c }; delete rec.virtual;
  if (prevDate && monthOf(prevDate) !== monthOf(rec.date)) {
    const om = month(monthOf(prevDate)); delete om.classes[rec.id]; saveMonth(monthOf(prevDate));
  }
  const m = monthOf(rec.date); month(m).classes[rec.id] = rec; saveMonth(m);
}
export function removeTimeFor(classId) {
  const t = D().timeByClass[classId]; if (!t) return;
  const m = monthOf(t.date); delete month(m).times[t.id]; saveMonth(m);
}
export function deleteClass(c) {
  removeTimeFor(c.id);
  if (c.rescheduledFrom && c.rescheduledFromDate) {
    const o = findClass(c.rescheduledFrom, c.rescheduledFromDate);
    if (o && o.status === 'rescheduled') { const r = { ...o, status: 'scheduled' }; delete r.rescheduledTo; putClass(r); }
  }
  const m = monthOf(c.date);
  if (c.recurring) month(m).classes[c.id] = { id: c.id, studentId: c.studentId, date: c.date, start: c.start, end: c.end, recurring: true, deleted: true, status: 'scheduled' };
  else delete month(m).classes[c.id];
  saveMonth(m);
}
export function putTime(t, prevDate) {
  if (t.start && t.end) t.minutes = durMin(t.start, t.end);
  if (prevDate && monthOf(prevDate) !== monthOf(t.date)) { delete month(monthOf(prevDate)).times[t.id]; saveMonth(monthOf(prevDate)); }
  const m = monthOf(t.date); month(m).times[t.id] = t; saveMonth(m);
}
export function deleteTime(t) { const m = monthOf(t.date); delete month(m).times[t.id]; saveMonth(m); }

export function timesIn(from, to, studentId) {
  return D().allTimes.filter(t => t.date >= from && t.date <= to && (!studentId || t.studentId === studentId));
}
export function totalsBy(times) {
  const by = {}; let total = 0;
  for (const t of times) { by[t.studentId] = (by[t.studentId] || 0) + (Number(t.minutes) || 0); total += Number(t.minutes) || 0; }
  return { total, by };
}
export function paymentsFor(m, sid) { return Object.values(S.months[m]?.payments || {}).filter(p => !sid || p.studentId === sid); }
export function payState(s, m) {
  const fee = billable(s, m) ? feeFor(s, m) : 0;
  const paid = paymentsFor(m, s.id).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const due = Math.max(fee - paid, 0);
  const status = fee === 0 && paid === 0 ? 'none' : paid >= fee ? 'paid' : paid > 0 ? 'partial' : 'due';
  return { fee, paid, due, status, billable: billable(s, m) };
}
export function outstanding(s, upto = curMonth()) {
  if (!s.startDate) return { total: 0, months: [] };
  let total = 0; const months = [];
  for (const m of monthsBetween(s.startDate, monthLast(upto))) { const p = payState(s, m); if (p.due > 0) { total += p.due; months.push({ m, due: p.due }); } }
  return { total, months };
}
/** Due = what is still unpaid of the PREVIOUS calendar month's fees (never the running month, never older months). */
export function prevMonthFinance(sid) {
  const m = prevMonthOf(curMonth());
  const studs = sid ? [S.students[sid]].filter(Boolean) : Object.values(S.students);
  let expected = 0, due = 0, owing = 0;
  for (const s of studs) { const p = payState(s, m); expected += p.fee; due += p.due; if (p.due > 0) owing++; }
  return { m, due, expected, owing };
}
export function monthSummary(m) {
  let expected = 0, due = 0;
  for (const s of Object.values(S.students)) { const p = payState(s, m); expected += p.fee; due += p.due; }
  const recAll = paymentsFor(m).filter(p => S.students[p.studentId]).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  return { expected, received: recAll, due };
}
export const PAYLABEL = { paid: ['Paid', 'b-paid'], partial: ['Partially paid', 'b-partial'], due: ['Due', 'b-due'], none: ['No fee', ''] };

/* Conflicts */
export function conflictsAt(date, start, end, { excludeId = null, excludeStudent = null } = {}) {
  if (!isTime(start) || !isTime(end) || toMin(end) <= toMin(start)) return [];
  const a = toMin(start), b = toMin(end); const out = [];
  for (const c of occurrences(date, date)) {
    if (c.id === excludeId || !isLive(c)) continue;
    if (excludeStudent && c.studentId === excludeStudent && c.recurring) continue;
    if (overlap(a, b, toMin(c.start), toMin(c.end))) out.push(`Tuition with ${S.students[c.studentId]?.name || 'a student'}, ${fmtT(c.start)}–${fmtT(c.end)}`);
  }
  for (const u of Object.values(S.uni)) {
    if (Number(u.day) === dow(date) && overlap(a, b, toMin(u.start), toMin(u.end))) out.push(`University: ${u.name}, ${fmtT(u.start)}–${fmtT(u.end)}`);
  }
  return out;
}
export function slotConflicts(slots, excludeStudent) {
  const out = [];
  for (const sl of slots) {
    if (!isTime(sl.start)) continue;
    const a = toMin(sl.start), b = a + Number(sl.duration || 0);
    for (const u of Object.values(S.uni)) if (Number(u.day) === Number(sl.day) && overlap(a, b, toMin(u.start), toMin(u.end))) out.push(`${DAYS[sl.day]}: university (${u.name}, ${fmtT(u.start)}–${fmtT(u.end)})`);
    for (const s of activeStudents()) {
      if (s.id === excludeStudent) continue;
      for (const o of currentSlots(s)) if (Number(o.day) === Number(sl.day) && overlap(a, b, toMin(o.start), toMin(o.start) + Number(o.duration || 0))) out.push(`${DAYS[sl.day]}: ${s.name}'s tuition (${fmtT(o.start)}–${fmtT(fromMin(toMin(o.start) + Number(o.duration)))})`);
    }
  }
  return out;
}
export function uniOn(date) { return Object.values(S.uni).filter(u => Number(u.day) === dow(date)).sort((a, b) => a.start.localeCompare(b.start)); }
export function weekStartOf(date) { const ws = Number(S.profile.weekStart ?? 6); let d = date; let g = 0; while (dow(d) !== ws && g++ < 7) d = addDays(d, -1); return d; }
export function rangeFor(key, from, to) {
  const t = todayStr();
  if (key === 'today') return [t, t];
  if (key === 'week') { const a = weekStartOf(t); return [a, addDays(a, 6)]; }
  if (key === 'month') return [monthFirst(curMonth()), monthLast(curMonth())];
  if (key === 'last30') return [addDays(t, -29), t];
  return [isDate(from) ? from : t, isDate(to) ? to : t];
}

/* Reminders */
export function reminders() {
  const out = []; const t = todayStr(); const n = nowMin();
  for (const c of occurrences(t, addDays(t, 1))) {
    if (!isLive(c) || c.status !== 'scheduled') continue;
    const s = S.students[c.studentId];
    const mins = (c.date === t ? 0 : 1440) + toMin(c.start) - n;
    if (mins > 0 && mins <= 180) out.push({ kind: 'class', key: `class:${c.id}`, c, text: `${s.name} at ${fmtT(c.start)}`, sub: `Starts in ${fmtDur(mins)}` });
  }
  const unmarked = occurrences(addDays(t, -14), t).filter(c => c.status === 'scheduled' && !c.deleted && classState(c).k === 'miss');
  if (unmarked.length) out.push({ kind: 'unmarked', key: `unmarked:${unmarked.map(c => c.id).join(',')}`, text: `${unmarked.length} past class${unmarked.length > 1 ? 'es' : ''} not marked`, sub: 'Mark them completed or cancelled' });
  const tomorrow = occurrences(addDays(t, 1), addDays(t, 1)).filter(isLive);
  if (tomorrow.length) out.push({ kind: 'tomorrow', key: `tomorrow:${addDays(t, 1)}:${tomorrow.length}`, text: `Tomorrow: ${tomorrow.length} class${tomorrow.length > 1 ? 'es' : ''}`, sub: `First at ${fmtT(tomorrow[0].start)} with ${S.students[tomorrow[0].studentId]?.name}` });
  if (new Date().getDate() >= Number(S.profile.dueDay || 10)) {
    const pm = prevMonthOf(curMonth());
    const dues = stuList().map(s => ({ s, due: payState(s, pm).due })).filter(x => x.due > 0);
    const sum = dues.reduce((a, x) => a + x.due, 0);
    if (dues.length) out.push({ kind: 'due', key: `due:${pm}:${dues.length}:${sum}`, text: `${dues.length} student${dues.length > 1 ? 's haven\'t' : ' hasn\'t'} paid for ${fmtMonth(pm)}`, sub: money(sum) + ' due' });
  }
  return out;
}
/* Read state of reminders is stored in the profile document, so it syncs and survives refresh/sign-in.
   A reminder's key changes when its content changes (e.g. a new unmarked class), which makes it unread again. */
export const isReminderRead = x => !!(S.profile.readReminders || {})[x.key];
export const unreadReminders = () => reminders().filter(x => !isReminderRead(x));
export function markRemindersRead(list) {
  if (!list.length) return;
  const t = todayStr(); const cutoff = addDays(t, -60); const r = {};
  for (const [k, d] of Object.entries(S.profile.readReminders || {})) if (d >= cutoff) r[k] = d;
  for (const x of list) r[x.key] = t;
  S.profile.readReminders = r; saveProfile();
}
export const prevMonthOf = m => addMonths(m, -1);
/** Completed classes for one student within one calendar month, by class date. */
export function completedInMonth(sid, m) { return occurrences(monthFirst(m), monthLast(m), { studentId: sid }).filter(c => c.status === 'completed'); }
