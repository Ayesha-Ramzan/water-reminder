const { MAX_SNOOZES, canSnooze, snoozeUntil, nextSnoozeCount } = require('../../src/logic/snooze');

test('max is 3', () => expect(MAX_SNOOZES).toBe(3));
test('canSnooze boundaries', () => {
  expect([0, 1, 2].every(canSnooze)).toBe(true);
  expect(canSnooze(3)).toBe(false);
});
test('4th snooze refused', () => {
  let c = 0;
  for (let i = 0; i < 3; i++) c = nextSnoozeCount(c);
  expect(c).toBe(3);
  expect(() => nextSnoozeCount(c)).toThrow(RangeError);
});
test('snoozeUntil adds minutes', () => {
  const now = new Date(2025, 11, 31, 23, 55);
  expect(snoozeUntil(now, 10)).toEqual(new Date(2026, 0, 1, 0, 5));
  expect(snoozeUntil(now, 1).getTime() - now.getTime()).toBe(60000);
  expect(snoozeUntil(now, 30).getTime() - now.getTime()).toBe(30 * 60000);
});
