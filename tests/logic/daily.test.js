const { dateKey, rolloverDaily, incrementDaily, progressRatio } = require('../../src/logic/daily');

test('dateKey local, zero padded', () => {
  expect(dateKey(new Date(2025, 0, 5, 23, 59))).toBe('2025-01-05');
  expect(dateKey(new Date(2025, 11, 31, 0, 0))).toBe('2025-12-31');
});
describe('rolloverDaily', () => {
  test('same day keeps count', () => {
    expect(rolloverDaily({ date: '2025-03-10', count: 4 }, new Date(2025, 2, 10, 15))).toEqual({ date: '2025-03-10', count: 4 });
  });
  test('midnight reset 23:59 -> 00:00', () => {
    const s = { date: dateKey(new Date(2025, 2, 10, 23, 59)), count: 5 };
    expect(rolloverDaily(s, new Date(2025, 2, 10, 23, 59)).count).toBe(5);
    expect(rolloverDaily(s, new Date(2025, 2, 11, 0, 0))).toEqual({ date: '2025-03-11', count: 0 });
  });
  test('month and year rollover', () => {
    expect(rolloverDaily({ date: '2025-01-31', count: 3 }, new Date(2025, 1, 1))).toEqual({ date: '2025-02-01', count: 0 });
    expect(rolloverDaily({ date: '2025-12-31', count: 3 }, new Date(2026, 0, 1))).toEqual({ date: '2026-01-01', count: 0 });
  });
  test('null/malformed -> fresh', () => {
    const now = new Date(2025, 2, 10);
    const fresh = { date: '2025-03-10', count: 0 };
    for (const s of [null, undefined, 'x', {}, { date: '2025-03-10', count: -1 }, { date: '2025-03-10', count: 'a' }]) {
      expect(rolloverDaily(s, now)).toEqual(fresh);
    }
  });
});
describe('incrementDaily', () => {
  test('+1 same day', () => {
    expect(incrementDaily({ date: '2025-03-10', count: 2 }, new Date(2025, 2, 10, 12))).toEqual({ date: '2025-03-10', count: 3 });
  });
  test('rolls over first', () => {
    expect(incrementDaily({ date: '2025-03-09', count: 7 }, new Date(2025, 2, 10, 0, 0))).toEqual({ date: '2025-03-10', count: 1 });
    expect(incrementDaily(null, new Date(2025, 2, 10))).toEqual({ date: '2025-03-10', count: 1 });
  });
});
test('progressRatio clamps', () => {
  expect(progressRatio(0, 8)).toBe(0);
  expect(progressRatio(4, 8)).toBe(0.5);
  expect(progressRatio(8, 8)).toBe(1);
  expect(progressRatio(12, 8)).toBe(1);
  expect(progressRatio(-1, 8)).toBe(0);
  expect(progressRatio(3, 0)).toBe(0);
});
