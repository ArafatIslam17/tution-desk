import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { historyStart, migrateLinkedTimes, prevMonthFinance, occurrences, feeFor, payState, outstanding, conflictsAt, slotConflicts, totalsBy, timesIn, classState, billable, monthSummary } from '../src/lib/domain.js';
import { S } from '../src/lib/state.js';
import { resetState, student, monthDoc } from './helpers.js';

beforeEach(() => { resetState(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 12, 0)); }); // Sat 26 Sep 2026, noon
afterEach(() => vi.useRealTimers());

describe('recurring schedule', () => {
  it('generates classes on the scheduled weekdays only', () => {
    student();
    const occ = occurrences('2026-09-20', '2026-09-26'); // Sun..Sat
    expect(occ.map(c => c.date)).toEqual(['2026-09-21', '2026-09-26']); // Monday, Saturday
    expect(occ[0]).toMatchObject({ start: '16:00', end: '17:30', subject: 'Math', status: 'scheduled', virtual: true });
  });

  it('does not generate classes before the start date', () => {
    student({ startDate: '2026-09-22' });
    expect(occurrences('2026-09-20', '2026-09-26').map(c => c.date)).toEqual(['2026-09-26']);
  });

  it('a stored override replaces the generated occurrence', () => {
    student();
    const id = 's1'.replace(/^/, 'r_') + '_2026-09-21_1';
    monthDoc('2026-09').classes[id] = { id, studentId: 's1', date: '2026-09-21', start: '16:00', end: '17:30', status: 'completed', recurring: true };
    S.v++;
    const c = occurrences('2026-09-21', '2026-09-21');
    expect(c).toHaveLength(1);
    expect(c[0].status).toBe('completed');
  });

  it('a deleted occurrence disappears but the schedule continues', () => {
    student();
    const id = 'r_s1_2026-09-21_1';
    monthDoc('2026-09').classes[id] = { id, studentId: 's1', date: '2026-09-21', start: '16:00', end: '17:30', recurring: true, deleted: true, status: 'scheduled' };
    S.v++;
    expect(occurrences('2026-09-20', '2026-09-26').map(c => c.date)).toEqual(['2026-09-26']);
  });

  it('schedule changes apply from their date without rewriting history', () => {
    const s = student();
    s.schedules.push({ from: '2026-09-23', slots: [{ day: 3, start: '09:00', duration: 60 }] }); // Wednesdays from 23 Sep
    S.v++;
    const occ = occurrences('2026-09-19', '2026-09-30');
    expect(occ.map(c => `${c.date} ${c.start}`)).toEqual(['2026-09-19 16:00', '2026-09-21 16:00', '2026-09-23 09:00', '2026-09-30 09:00']);
  });

  it('paused students keep past classes but get no new ones', () => {
    student({ status: 'paused', statusSince: '2026-09-22' });
    expect(occurrences('2026-09-15', '2026-09-30').map(c => c.date)).toEqual(['2026-09-19', '2026-09-21']);
  });
});

describe('class state', () => {
  const base = { start: '16:00', end: '17:30', status: 'scheduled' };
  it('labels upcoming, in-progress and unmarked classes by the clock', () => {
    expect(classState({ ...base, date: '2026-09-26' }).k).toBe('up');
    expect(classState({ ...base, date: '2026-09-25' }).k).toBe('miss');
    vi.setSystemTime(new Date(2026, 8, 26, 16, 30));
    expect(classState({ ...base, date: '2026-09-26' }).k).toBe('now');
  });
});

describe('teaching time', () => {
  it('counts End - Start of every completed class, plus extra sessions, per student', () => {
    student(); student({ id: 's2', name: 'Rahim' });
    const m = monthDoc('2026-09');
    m.classes.a = { id: 'a', studentId: 's1', date: '2026-09-21', start: '16:00', end: '17:35', status: 'completed' };
    m.classes.b = { id: 'b', studentId: 's2', date: '2026-09-22', start: '18:00', end: '19:00', status: 'completed' };
    m.classes.c = { id: 'c', studentId: 's2', date: '2026-09-24', start: '18:00', end: '19:00', status: 'cancelled' }; // not taught
    m.classes.d = { id: 'd', studentId: 's1', date: '2026-08-30', start: '16:00', end: '17:00', status: 'completed' };  // outside range
    m.times.x = { id: 'x', studentId: 's1', classId: null, date: '2026-09-23', start: '10:00', end: '10:40', minutes: 40 }; // extra session
    S.v++;
    const t = totalsBy(timesIn('2026-09-20', '2026-09-26'));
    expect(t.total).toBe(95 + 60 + 40);
    expect(t.by).toEqual({ s1: 135, s2: 60 });
  });
  it('scheduled classes and invalid ranges add no hours', () => {
    student();
    const m = monthDoc('2026-09');
    m.classes.a = { id: 'a', studentId: 's1', date: '2026-09-21', start: '16:00', end: '17:00', status: 'scheduled' };
    m.classes.b = { id: 'b', studentId: 's1', date: '2026-09-22', start: '17:00', end: '17:00', status: 'completed' };
    S.v++;
    expect(totalsBy(timesIn('2026-09-01', '2026-09-30')).total).toBe(0);
  });
  it('ignores records of deleted students', () => {
    student();
    monthDoc('2026-09').times.z = { id: 'z', studentId: 'gone', classId: null, date: '2026-09-21', start: '10:00', end: '11:00', minutes: 60 };
    S.v++;
    expect(totalsBy(timesIn('2026-09-01', '2026-09-30')).total).toBe(0);
  });
  it('upgrades older linked time records onto their class, once', () => {
    student();
    const m = monthDoc('2026-09');
    m.classes.L1 = { id: 'L1', studentId: 's1', date: '2026-09-10', start: '16:00', end: '17:30', status: 'completed' };
    m.times.T1 = { id: 'T1', studentId: 's1', classId: 'L1', date: '2026-09-10', start: '16:05', end: '17:50', minutes: 105 };
    m.classes.L2 = { id: 'L2', studentId: 's1', date: '2026-09-12', start: '16:00', end: '17:30', status: 'scheduled' };
    m.times.T2 = { id: 'T2', studentId: 's1', classId: 'L2', date: '2026-09-12', start: null, end: null, minutes: 70 };
    m.times.T3 = { id: 'T3', studentId: 's1', classId: 'GONE', date: '2026-09-13', start: '09:00', end: '09:45', minutes: 45 };
    S.v++;
    migrateLinkedTimes();
    expect(m.classes.L1).toMatchObject({ start: '16:05', end: '17:50' });
    expect(m.classes.L2).toMatchObject({ end: '17:10', status: 'completed' });
    expect(Object.keys(m.times)).toEqual(['T3']);
    expect(m.times.T3.classId).toBe(null);
    expect(totalsBy(timesIn('2026-09-01', '2026-09-30')).total).toBe(105 + 70 + 45);
    migrateLinkedTimes(); S.v++;
    expect(totalsBy(timesIn('2026-09-01', '2026-09-30')).total).toBe(220);
  });
});

describe('payments', () => {
  it('computes paid / partial / due per month', () => {
    const s = student();
    expect(payState(s, '2026-09')).toMatchObject({ fee: 5000, paid: 0, due: 5000, status: 'due' });
    monthDoc('2026-09').payments.p1 = { id: 'p1', studentId: 's1', forMonth: '2026-09', amount: 3000, date: '2026-09-05' }; S.v++;
    expect(payState(s, '2026-09')).toMatchObject({ paid: 3000, due: 2000, status: 'partial' });
    monthDoc('2026-09').payments.p2 = { id: 'p2', studentId: 's1', forMonth: '2026-09', amount: 2000, date: '2026-09-20' }; S.v++;
    expect(payState(s, '2026-09').status).toBe('paid');
  });
  it('uses the fee in effect for each month and per-month overrides', () => {
    const s = student({ fees: [{ from: '2026-08', amount: 5000 }, { from: '2026-10', amount: 6000 }] });
    expect(feeFor(s, '2026-09')).toBe(5000);
    expect(feeFor(s, '2026-10')).toBe(6000);
    monthDoc('2026-09').fees.s1 = 0; S.v++;
    expect(feeFor(s, '2026-09')).toBe(0);
  });
  it('adds up outstanding dues across months', () => {
    const s = student();
    monthDoc('2026-08').payments.p = { id: 'p', studentId: 's1', forMonth: '2026-08', amount: 4000, date: '2026-08-05' }; S.v++;
    const o = outstanding(s);
    expect(o.total).toBe(6000);
    expect(o.months.map(x => x.m)).toEqual(['2026-08', '2026-09']);
  });
  it('does not bill months before the start date or after a student finishes', () => {
    const s = student({ status: 'finished', statusSince: '2026-08-20' });
    expect(billable(s, '2026-07')).toBe(false);
    expect(billable(s, '2026-08')).toBe(true);
    expect(billable(s, '2026-09')).toBe(false);
  });
  it('Due is the previous calendar month only', () => {
    student(); student({ id: 's2', name: 'Rahim', fees: [{ from: '2026-08', amount: 6000 }] });
    monthDoc('2026-09').payments.p = { id: 'p', studentId: 's1', forMonth: '2026-09', amount: 3000, date: '2026-09-05' };
    monthDoc('2026-08').payments.q = { id: 'q', studentId: 's1', forMonth: '2026-08', amount: 1000, date: '2026-08-05' };
    S.v++;
    vi.setSystemTime(new Date(2026, 9, 2, 12, 0)); // 2 Oct 2026
    expect(prevMonthFinance()).toMatchObject({ m: '2026-09', expected: 11000, due: 8000, owing: 2 });
    expect(prevMonthFinance('s1')).toMatchObject({ due: 2000 });
  });
  it('Due crosses the year boundary', () => {
    student({ startDate: '2026-11-01', fees: [{ from: '2026-11', amount: 8000 }] });
    monthDoc('2026-12').payments.p = { id: 'p', studentId: 's1', forMonth: '2026-12', amount: 2000, date: '2026-12-05' };
    S.v++;
    vi.setSystemTime(new Date(2027, 0, 10, 12, 0));
    expect(prevMonthFinance()).toMatchObject({ m: '2026-12', due: 6000 });
  });
  it('summarises the month', () => {
    student(); student({ id: 's2', name: 'Rahim', fees: [{ from: '2026-08', amount: 6000 }] });
    monthDoc('2026-09').payments.p = { id: 'p', studentId: 's1', forMonth: '2026-09', amount: 5000, date: '2026-09-05' }; S.v++;
    expect(monthSummary('2026-09')).toEqual({ expected: 11000, received: 5000, due: 6000 });
  });
});

describe('conflict warnings', () => {
  it('detects overlap with tuition and university, but not back-to-back', () => {
    student();
    S.uni.u = { id: 'u', day: 6, start: '10:00', end: '11:30', name: 'Software Engineering' }; S.v++;
    expect(conflictsAt('2026-09-26', '10:30', '11:00')).toEqual(['University: Software Engineering, 10:00 AM–11:30 AM']);
    expect(conflictsAt('2026-09-26', '17:00', '18:00')[0]).toMatch(/Tuition with Abdullah/);
    expect(conflictsAt('2026-09-26', '17:30', '18:30')).toEqual([]);
    expect(conflictsAt('2026-09-26', '11:30', '12:00')).toEqual([]);
  });
  it('ignores cancelled classes', () => {
    student();
    const id = 'r_s1_2026-09-26_0';
    monthDoc('2026-09').classes[id] = { id, studentId: 's1', date: '2026-09-26', start: '16:00', end: '17:30', status: 'cancelled', recurring: true }; S.v++;
    expect(conflictsAt('2026-09-26', '16:00', '17:00')).toEqual([]);
  });
  it('checks weekly slots against university and other students', () => {
    student();
    S.uni.u = { id: 'u', day: 1, start: '15:00', end: '16:30', name: 'DSP' }; S.v++;
    const w = slotConflicts([{ day: 1, start: '16:00', duration: 60 }], 'other');
    expect(w).toHaveLength(2);
  });
});

describe('historical classes', () => {
  it('a class dated before the student\'s start date is part of their history', () => {
    const s = student({ startDate: '2026-09-26', schedules: [] });
    monthDoc('2026-09').classes.h1 = { id: 'h1', studentId: 's1', date: '2026-09-03', start: '16:00', end: '17:30', status: 'completed' };
    monthDoc('2026-08').classes.h2 = { id: 'h2', studentId: 's1', date: '2026-08-12', start: '16:00', end: '17:00', status: 'completed' };
    S.v++;
    expect(historyStart(s)).toBe('2026-08-12');
    expect(occurrences(historyStart(s), '2026-09-26', { studentId: 's1' }).map(c => c.date)).toEqual(['2026-08-12', '2026-09-03']);
  });
  it('ignores deleted classes and other students when finding the first date', () => {
    const s = student({ startDate: '2026-09-26', schedules: [] });
    monthDoc('2026-07').classes.d = { id: 'd', studentId: 's1', date: '2026-07-01', start: '10:00', end: '11:00', deleted: true, status: 'scheduled' };
    monthDoc('2026-06').classes.o = { id: 'o', studentId: 'other', date: '2026-06-01', start: '10:00', end: '11:00', status: 'completed' };
    S.v++;
    expect(historyStart(s)).toBe('2026-09-26');
  });
  it('a teaching-time record without a class also extends history', () => {
    const s = student({ startDate: '2026-09-26', schedules: [] });
    monthDoc('2026-09').times.t = { id: 't', studentId: 's1', classId: null, date: '2026-09-05', start: '10:00', end: '11:00', minutes: 60 };
    S.v++;
    expect(historyStart(s)).toBe('2026-09-05');
  });
});
