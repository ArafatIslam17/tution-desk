import { describe, it, expect, beforeEach } from 'vitest';
import { buildBackup, validateBackup } from '../src/lib/backup.js';
import { resetState, student, monthDoc } from './helpers.js';
import { S } from '../src/lib/state.js';

beforeEach(resetState);

describe('backup', () => {
  it('round-trips through JSON and validates', () => {
    student();
    monthDoc('2026-09').payments.p = { id: 'p', studentId: 's1', forMonth: '2026-09', amount: 3000, date: '2026-09-05' };
    monthDoc('2026-09').times.t = { id: 't', studentId: 's1', date: '2026-09-21', start: '16:00', end: '17:30', minutes: 90 };
    S.uni.u = { id: 'u', day: 0, start: '10:00', end: '11:30', name: 'SE' };
    const b = JSON.parse(JSON.stringify(buildBackup()));
    expect(b.app).toBe('tuition-desk');
    expect(validateBackup(b)).toBe(b);
    expect(b.students).toHaveLength(1);
    expect(b.months['2026-09'].payments.p.amount).toBe(3000);
  });
  it('rejects files that are not Tuition Desk backups', () => {
    expect(() => validateBackup(null)).toThrow();
    expect(() => validateBackup({ app: 'other' })).toThrow(/not a Tuition Desk backup/);
    expect(() => validateBackup({ app: 'tuition-desk', students: [], university: [] })).toThrow(/missing/);
  });
  it('rejects damaged records', () => {
    const ok = { app: 'tuition-desk', schema: 1, students: [], university: [], months: {} };
    expect(() => validateBackup({ ...ok, students: [{ id: 'a', name: 'X', status: 'weird' }] })).toThrow(/student/);
    expect(() => validateBackup({ ...ok, months: { '2026-09': { classes: { c: { id: 'c', date: 'bad', start: '10:00', end: '11:00' } } } } })).toThrow(/class/);
    expect(() => validateBackup({ ...ok, months: { 'nope': {} } })).toThrow(/Month/);
    expect(() => validateBackup({ ...ok, students: [{ id: 'bad/id', name: 'X', status: 'active' }] })).toThrow(/ids/);
    expect(() => validateBackup({ ...ok, schema: 2 })).toThrow(/newer/);
  });
});
