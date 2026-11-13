const { nextReminderTime, isWithinActiveHours } = require('../../src/logic/schedule');
const { DEFAULTS } = require('../../src/logic/settings');

const S = { ...DEFAULTS, intervalMin: 60, startTime: '09:00', endTime: '21:00' };
const d = (y, m, day, h, min = 0) => new Date(y, m - 1, day, h, min);

describe('isWithinActiveHours', () => {
  test('start inclusive, end exclusive', () => {
    expect(isWithinActiveHours(d(2025, 3, 10, 9, 0), S)).toBe(true);
    expect(isWithinActiveHours(d(2025, 3, 10, 8, 59), S)).toBe(false);
    expect(isWithinActiveHours(d(2025, 3, 10, 20, 59), S)).toBe(true);
    expect(isWithinActiveHours(d(2025, 3, 10, 21, 0), S)).toBe(false);
  });
  test('overnight', () => {
    const o = { ...S, startTime: '22:00', endTime: '06:00' };
    expect(isWithinActiveHours(d(2025, 3, 10, 23, 0), o)).toBe(true);
    expect(isWithinActiveHours(d(2025, 3, 10, 5, 59), o)).toBe(true);
    expect(isWithinActiveHours(d(2025, 3, 10, 6, 0), o)).toBe(false);
    expect(isWithinActiveHours(d(2025, 3, 10, 12, 0), o)).toBe(false);
    expect(isWithinActiveHours(d(2025, 3, 10, 22, 0), o)).toBe(true);
  });
});

describe('nextReminderTime', () => {
  test('now + interval inside window', () => {
    expect(nextReminderTime(d(2025, 3, 10, 10, 0), S)).toEqual(d(2025, 3, 10, 11, 0));
  });
  test('lands exactly on end -> next day start', () => {
    expect(nextReminderTime(d(2025, 3, 10, 20, 0), S)).toEqual(d(2025, 3, 11, 9, 0));
  });
  test('past end -> next day start', () => {
    expect(nextReminderTime(d(2025, 3, 10, 22, 30), S)).toEqual(d(2025, 3, 11, 9, 0));
  });
  test('before start -> same day start', () => {
    expect(nextReminderTime(d(2025, 3, 10, 6, 0), S)).toEqual(d(2025, 3, 10, 9, 0));
  });
  test('month rollover', () => {
    expect(nextReminderTime(d(2025, 1, 31, 22, 0), S)).toEqual(d(2025, 2, 1, 9, 0));
  });
  test('year rollover', () => {
    expect(nextReminderTime(d(2025, 12, 31, 22, 0), S)).toEqual(d(2026, 1, 1, 9, 0));
  });
  test('overnight: inside window crossing midnight', () => {
    const o = { ...S, startTime: '22:00', endTime: '06:00' };
    expect(nextReminderTime(d(2025, 3, 10, 23, 30), o)).toEqual(d(2025, 3, 11, 0, 30));
  });
  test('overnight: gap -> today start; after end -> same-day start', () => {
    const o = { ...S, startTime: '22:00', endTime: '06:00' };
    expect(nextReminderTime(d(2025, 3, 10, 12, 0), o)).toEqual(d(2025, 3, 10, 22, 0));
    expect(nextReminderTime(d(2025, 3, 10, 5, 30), o)).toEqual(d(2025, 3, 10, 22, 0));
  });
});
