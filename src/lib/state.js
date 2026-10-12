/* ================= State ================= */


export const DEFAULT_PROFILE = { name: '', currency: '৳', weekStart: 6, dueDay: 10, theme: 'system', schema: 1 };
export const S = { profile: { ...DEFAULT_PROFILE }, students: {}, uni: {}, months: {}, v: 0 };
export const ui = {
  cal: { view: null, date: null }, stuQ: '', stuF: 'active', cls: { range: 'month', from: '', to: '', student: '', status: '', subject: '' },
  time: { range: 'week', from: '', to: '', student: '' }, pay: { month: null, f: 'all' }, prof: { hSubject: '', hStatus: '' },
};

