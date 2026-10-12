import { describe, it, expect } from 'vitest';
import { fmtDur, fmtT, toMin, fromMin, addDays, monthsBetween, monthLast, isTime, isDate, isMonth, addMonths } from '../src/lib/utils.js';

describe('time and date helpers', () => {
  it('formats durations', () => {
    expect(fmtDur(90)).toBe('1h 30m');
    expect(fmtDur(60)).toBe('1h');
    expect(fmtDur(45)).toBe('45m');
    expect(fmtDur(0)).toBe('0m');
  });
  it('formats 12-hour times', () => {
    expect(fmtT('00:05')).toBe('12:05 AM');
    expect(fmtT('12:00')).toBe('12:00 PM');
    expect(fmtT('19:30')).toBe('7:30 PM');
    expect(fmtT('bad')).toBe('—');
  });
  it('converts minutes', () => {
    expect(toMin('16:05')).toBe(965);
    expect(fromMin(965)).toBe('16:05');
  });
  it('does calendar arithmetic across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(monthLast('2026-02')).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthsBetween('2026-11-15', '2027-02-01')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
  it('validates inputs', () => {
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isDate('2026-09-26')).toBe(true);
    expect(isDate('26/09/2026')).toBe(false);
    expect(isMonth('2026-13')).toBe(false);
  });
});
