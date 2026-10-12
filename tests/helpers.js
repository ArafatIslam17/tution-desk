import { S, DEFAULT_PROFILE } from '../src/lib/state.js';

/** Reset in-memory state before each test. */
export function resetState() {
  S.profile = { ...DEFAULT_PROFILE }; S.students = {}; S.uni = {}; S.months = {}; S.v++;
}

export function student(over = {}) {
  const s = {
    id: 's1', name: 'Abdullah', grade: 'Class 8', subjects: ['Math', 'Science'], status: 'active', statusSince: '2026-08-01',
    startDate: '2026-08-01', fees: [{ from: '2026-08', amount: 5000 }],
    schedules: [{ from: '2026-08-01', slots: [{ day: 6, start: '16:00', duration: 90 }, { day: 1, start: '16:00', duration: 90 }] }],
    noteLog: [], ...over,
  };
  S.students[s.id] = s; S.v++; return s;
}

export function monthDoc(m) {
  S.months[m] ||= { classes: {}, payments: {}, times: {}, fees: {} };
  return S.months[m];
}
