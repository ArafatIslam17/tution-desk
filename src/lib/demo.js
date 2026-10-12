/* ================= Demo data ================= */
import { month, occurrences, plannedMin, saveMonth, saveStudent, saveUni } from './domain.js';
import { S } from './state.js';
import { AVCOLORS, addDays, addMonths, curMonth, dow, fromMin, monthFirst, monthOf, toMin, todayStr, uid } from './utils.js';
import { confirmBox, toast } from '../ui/modal.js';
import { scheduleRender } from '../ui/shell.js';
export function loadDemo() {
  const t = todayStr(); const start = monthFirst(addMonths(curMonth(), -1));
  const mk = (name, grade, subjects, fee, days, st, dur, loc, color, school, g) => ({ id: 'demo_' + name.toLowerCase(), demo: true, name, grade, subjects, school, guardianName: g, guardianPhone: '01700-000000', location: loc, status: 'active', statusSince: start, startDate: start, color, fees: [{ from: monthOf(start), amount: fee }], schedules: [{ from: start, slots: days.map(d => ({ day: d, start: st, duration: dur })) }], notes: '', noteLog: [], createdAt: new Date().toISOString() });
  const td = dow(t); const D7 = n => (td + n) % 7;
  const studs = [
    mk('Abdullah', 'Class 8', ['Math', 'Science'], 5000, [D7(0), D7(2), D7(4)], '16:00', 90, "Student's home, Nasirabad", AVCOLORS[0], 'Chittagong Collegiate School', 'Mr. Karim'),
    mk('Rahim', 'Class 10', ['Physics', 'Chemistry'], 6000, [D7(1), D7(3), D7(5)], '18:00', 60, 'GEC Circle', AVCOLORS[1], 'Govt. Muslim High School', 'Mrs. Rahman'),
    mk('Nusrat', 'HSC 1st year', ['English'], 4000, [D7(0), D7(3)], '20:00', 90, 'Online', AVCOLORS[2], 'Chittagong College', 'Mr. Hossain'),
    mk('Ayan', 'Class 6', ['Math'], 3500, [D7(1), D7(4)], '17:30', 60, 'Agrabad', AVCOLORS[3], '', 'Mrs. Ahmed'),
  ];
  studs[0].noteLog = [{ id: uid(), date: addDays(t, -10), text: 'Weak in algebra. Needs extra practice with factorisation.' }];
  studs[3].status = 'active';
  for (const s of studs) S.students[s.id] = s;
  const unis = [[D7(0), '10:00', '11:30', 'Software Engineering', 'CSE-301'], [D7(1), '09:00', '10:30', 'Digital Signal Processing', 'EEE-305'], [D7(2), '14:00', '15:30', 'DSP Lab', 'EEE-306'], [D7(4), '11:00', '12:30', 'Machine Learning', 'CSE-417']];
  unis.forEach(([day, st, en, name, code], i) => { const id = 'demo_uni' + i; S.uni[id] = { id, demo: true, day, start: st, end: en, name, code, room: 'Academic Building ' + (i + 1), notes: '' }; });
  // Past occurrences: mostly completed, some with time, a couple cancelled
  let k = 0; const touched = new Set();
  for (const c of occurrences(start, addDays(t, -1))) {
    k++; const r = { ...c, demo: true }; delete r.virtual;
    if (k % 11 === 0) r.status = 'cancelled';
    else if (k % 13 === 0) { /* leave unmarked */ continue; }
    else { r.status = 'completed'; if (k % 5 === 0) r.note = ['Quadratic equations', 'Newton\'s laws revision', 'Essay structure', 'Fractions practice'][k % 4]; }
    const m = monthOf(r.date); month(m).classes[r.id] = r; touched.add(m);
    if (r.status === 'completed') { const extra = [0, 5, -10, 10, 0][k % 5]; r.end = fromMin(toMin(r.start) + plannedMin(r) + extra); }
  }
  // Payments: last month mostly paid, this month partial
  const lm = addMonths(curMonth(), -1), cm = curMonth();
  const pays = [['demo_abdullah', lm, 5000], ['demo_rahim', lm, 6000], ['demo_nusrat', lm, 4000], ['demo_ayan', lm, 2000], ['demo_abdullah', cm, 3000], ['demo_nusrat', cm, 4000]];
  pays.forEach(([sid, m, amt], i) => { const id = 'demo_p' + i; month(m).payments[id] = { id, demo: true, studentId: sid, forMonth: m, amount: amt, date: m === cm ? addDays(monthFirst(cm), Math.min(4, new Date().getDate() - 1)) : addDays(monthFirst(m), 6), note: i % 2 ? 'bKash' : 'Cash' }; touched.add(m); });
  studs.forEach(s => saveStudent(s.id)); Object.keys(S.uni).filter(i => i.startsWith('demo_')).forEach(saveUni); touched.forEach(saveMonth);
  toast('Sample data loaded. Remove it any time from Settings.', { ms: 5000 }); scheduleRender();
}
export function removeDemo() {
  confirmBox({
    title: 'Remove sample data?', text: 'Removes the sample students, their classes, times and payments, and the sample university classes. Your own data stays.', ok: 'Remove sample data',
    onOk: () => {
      const ids = new Set(Object.values(S.students).filter(s => s.demo).map(s => s.id));
      ids.forEach(id => { delete S.students[id]; saveStudent(id); });
      Object.values(S.uni).filter(u => u.demo).forEach(u => { delete S.uni[u.id]; saveUni(u.id); });
      for (const [mk, m] of Object.entries(S.months)) { let ch = false; for (const k of ['classes', 'payments', 'times']) for (const [rid, x] of Object.entries(m[k] || {})) if (x.demo || ids.has(x.studentId)) { delete m[k][rid]; ch = true; } for (const sid of Object.keys(m.fees || {})) if (ids.has(sid)) { delete m.fees[sid]; ch = true; } if (ch) { if (!Object.keys(m.classes).length && !Object.keys(m.payments).length && !Object.keys(m.times).length && !Object.keys(m.fees).length) delete S.months[mk]; saveMonth(mk); } }
      toast('Sample data removed'); scheduleRender();
    },
  });
}

