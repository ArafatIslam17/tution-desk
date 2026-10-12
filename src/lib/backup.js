/* ================= Backup format & validation ================= */


import { S } from './state.js';
import { clone, isDate, isMonth, isTime } from './utils.js';
export function buildBackup() {
  return { app: 'tuition-desk', schema: 1, exportedAt: new Date().toISOString(), profile: clone(S.profile), students: Object.values(clone(S.students)), university: Object.values(clone(S.uni)), months: clone(S.months) };
}
export function validateBackup(b) {
  if (!b || typeof b !== 'object') throw new Error('The file is not a valid backup.');
  if (b.app !== 'tuition-desk') throw new Error('This file is not a Tuition Desk backup.');
  if (!Array.isArray(b.students) || !Array.isArray(b.university) || typeof b.months !== 'object' || !b.months) throw new Error('The backup is missing students, university or month data.');
  if (Number(b.schema) > 1) throw new Error('This backup is from a newer version of the app.');
  for (const s of b.students) if (!s || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !['active', 'paused', 'finished'].includes(s.status)) throw new Error('A student record in the backup is damaged.');
  for (const u of b.university) if (!u || typeof u.id !== 'string' || !isTime(u.start) || !isTime(u.end)) throw new Error('A university record in the backup is damaged.');
  for (const [k, m] of Object.entries(b.months)) {
    if (!isMonth(k) || typeof m !== 'object') throw new Error(`Month "${k}" in the backup is damaged.`);
    for (const c of Object.values(m.classes || {})) if (!c.id || !isDate(c.date) || !isTime(c.start) || !isTime(c.end)) throw new Error('A class record in the backup is damaged.');
    for (const p of Object.values(m.payments || {})) if (!p.id || !isFinite(Number(p.amount))) throw new Error('A payment record in the backup is damaged.');
    for (const t of Object.values(m.times || {})) if (!t.id || !isDate(t.date) || !isFinite(Number(t.minutes))) throw new Error('A time record in the backup is damaged.');
  }
  const idOk = x => /^[A-Za-z0-9_\-.~:@+]{1,150}$/.test(x);
  if (![...b.students.map(s => s.id), ...b.university.map(u => u.id)].every(idOk)) throw new Error('The backup contains invalid record ids.');
  return b;
}
